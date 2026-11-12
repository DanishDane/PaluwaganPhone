// Receipt storage and payment review. Images are private SQLite blobs, never public assets.
const crypto = require('node:crypto');

module.exports = function paymentReview({ db, L, api, seller, auth, wrap, HttpError, bad, num, str, memberOr404, groupOr404, now }) {
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args).map(row => ({ ...row }));
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_proofs (
      id INTEGER PRIMARY KEY, filename TEXT NOT NULL, mime TEXT NOT NULL,
      image BLOB NOT NULL, sha256 TEXT NOT NULL, created TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS payment_proofs_sha ON payment_proofs(sha256);
    CREATE TABLE IF NOT EXISTS payment_submissions (
      id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      group_id INTEGER NOT NULL REFERENCES pgroups(id) ON DELETE CASCADE,
      period TEXT NOT NULL, amount REAL NOT NULL, fine REAL NOT NULL DEFAULT 0,
      paid_on TEXT NOT NULL, method TEXT NOT NULL, ref TEXT NOT NULL, note TEXT,
      proof_id INTEGER NOT NULL REFERENCES payment_proofs(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      created TEXT NOT NULL, reviewed_at TEXT, reviewed_by INTEGER REFERENCES sellers(id),
      review_note TEXT, payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL);
    CREATE INDEX IF NOT EXISTS submissions_member_status ON payment_submissions(member_id, status);
  `);
  if (!all('PRAGMA table_info(payments)').some(column => column.name === 'proof_id')) {
    db.exec('ALTER TABLE payments ADD COLUMN proof_id INTEGER REFERENCES payment_proofs(id)');
  }
  const methods = ['Cash', 'GCash', 'Maya', 'Bank transfer', 'Other'];
  const refKey = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const transaction = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  function parseProof(proof) {
    if (!proof || typeof proof.data !== 'string') bad('Attach a receipt image.');
    if (proof.data.length > 6990508) throw new HttpError(413, 'Receipt must be 5 MB or smaller.');
    if (proof.data.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(proof.data)) bad('Invalid receipt image.');
    const bytes = Buffer.from(proof.data, 'base64');
    if (!bytes.length || bytes.length > 5 * 1024 * 1024 || bytes.toString('base64') !== proof.data) bad('Receipt must be a valid image of 5 MB or smaller.');
    let mime;
    if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii', 12, 16) === 'IHDR') mime = 'image/png';
    if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217) mime = 'image/jpeg';
    if (bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && bytes.readUInt32LE(4) + 8 === bytes.length) mime = 'image/webp';
    if (!mime || mime !== proof.type) bad('Upload a PNG, JPEG, or WebP image with the correct file type.');
    return { bytes, mime, sha: crypto.createHash('sha256').update(bytes).digest('hex'), filename: str(proof.name, 'Filename', { max: 120 }).replace(/[\r\n\x00-\x1f\\/]/g, '_') };
  }
  function storeProof(proof) {
    return Number(run('INSERT INTO payment_proofs(filename,mime,image,sha256,created) VALUES(?,?,?,?,?)', proof.filename, proof.mime, proof.bytes, proof.sha, now()).lastInsertRowid);
  }
  function validate(body) {
    const member = memberOr404(body.member_id);
    const group = groupOr404(member.group_id);
    const period = str(body.period, 'Month', { max: 7 });
    if (!L.groupPeriods(group).some(p => p.period === period)) bad('Choose a valid month for this group.');
    const paid_on = str(body.paid_on || L.todayStr(), 'Date paid', { max: 10 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paid_on) || !Number.isFinite(Date.parse(paid_on + 'T00:00:00Z')) || new Date(paid_on + 'T00:00:00Z').toISOString().slice(0, 10) !== paid_on || paid_on > L.todayStr()) bad('Choose a valid payment date that is not in the future.');
    const amount = num(body.amount, 'Amount', { min: 0 });
    const fine = num(body.fine || 0, 'Fine', { min: 0 });
    if (amount + fine <= 0 || amount + fine > 100000000) bad('Enter a payment total between 0.01 and 100,000,000.');
    if ([amount, fine].some(value => Math.abs(value - L.round2(value)) > 0.0000001)) bad('Amounts may have at most two decimal places.');
    const paid = one('SELECT COALESCE(SUM(amount),0) total FROM payments WHERE member_id=? AND period=?', member.id, period).total;
    const balance = L.round2(group.monthly - paid);
    if (amount > balance + .005) bad(balance <= 0 ? 'This month is already fully paid.' : `Amount exceeds the remaining balance of PHP ${balance}.`);
    const schedule = L.computeMember(group, member, all('SELECT * FROM payments WHERE member_id=?', member.id), all('SELECT * FROM waivers WHERE member_id=?', member.id), null, paid_on);
    const fineBalance = schedule.periods.find(item => item.period === period).fineBalance;
    if (fine > fineBalance + .005) bad(`Fine exceeds the outstanding fine of PHP ${fineBalance} on the transfer date.`);
    const method = str(body.method || 'Cash', 'Method', { max: 40 });
    if (!methods.includes(method)) bad('Choose a supported payment method.');
    const ref = str(body.ref, 'Transaction reference', { required: method !== 'Cash', max: 80 });
    if (method !== 'Cash' && !refKey(ref)) bad('Enter the transaction reference from your receipt.');
    const note = str(body.note, 'Note', { required: false, max: 300 });
    return { member, group, period, amount, fine, paid_on, method, ref, note };
  }
  function duplicate(data, sha, ignoreSubmission = 0) {
    const key = refKey(data.ref);
    const payments = all(`SELECT p.id,p.method,p.ref,r.sha256 FROM payments p LEFT JOIN payment_proofs r ON r.id=p.proof_id`);
    if (payments.some(p => (sha && p.sha256 === sha) || (key && p.method === data.method && refKey(p.ref) === key))) return 'This receipt or transaction reference is already attached to a recorded payment.';
    const pending = all(`SELECT s.id,s.method,s.ref,r.sha256 FROM payment_submissions s JOIN payment_proofs r ON r.id=s.proof_id WHERE s.status='pending' AND s.id != ?`, ignoreSubmission);
    if (pending.some(p => (sha && p.sha256 === sha) || (key && p.method === data.method && refKey(p.ref) === key))) return 'This receipt or transaction reference is already awaiting review.';
    return null;
  }
  function insertPayment(data, proofId) {
    return Number(run('INSERT INTO payments(member_id,group_id,period,amount,fine,paid_on,method,ref,note,created,proof_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      data.member.id, data.group.id, data.period, data.amount, data.fine, data.paid_on, data.method, data.ref, data.note, now(), proofId || null).lastInsertRowid);
  }
  function createPayment(body) {
    return transaction(() => {
      const data = validate(body);
      const proof = body.proof ? parseProof(body.proof) : null;
      if (data.method !== 'Cash' && !proof) bad('Attach proof of payment for a non-cash transaction.');
      const conflict = duplicate(data, proof?.sha);
      if (conflict) throw new HttpError(409, conflict);
      return { id: insertPayment(data, proof ? storeProof(proof) : null) };
    });
  }
  const owned = (req, id) => req.session.role === 'seller' || JSON.parse(req.session.ref).includes(Number(id));
  const columns = `s.*,m.name AS member,m.phone,g.name AS grp,r.filename,r.sha256,u.name AS reviewer,
    CASE WHEN s.status='approved' AND s.payment_id IS NULL THEN 1 ELSE 0 END AS payment_voided`;
  const joins = 'FROM payment_submissions s JOIN members m ON m.id=s.member_id JOIN pgroups g ON g.id=s.group_id JOIN payment_proofs r ON r.id=s.proof_id LEFT JOIN sellers u ON u.id=s.reviewed_by';
  api.post('/payment-submissions', auth('member'), wrap(req => transaction(() => {
    if (!owned(req, req.body.member_id)) throw new HttpError(403, 'You may only submit payments for your own membership.');
    const data = validate(req.body);
    if (data.method === 'Cash') bad('Submit electronic transfer receipts here. Ask your seller to record cash payments.');
    const proof = parseProof(req.body.proof);
    const conflict = duplicate(data, proof.sha);
    if (conflict) throw new HttpError(409, conflict);
    if (one("SELECT COUNT(*) total FROM payment_submissions WHERE member_id=? AND status='pending'", data.member.id).total >= 20) throw new HttpError(429, 'You have 20 pending submissions. Contact your seller before submitting more.');
    const proofId = storeProof(proof);
    const result = run('INSERT INTO payment_submissions(member_id,group_id,period,amount,fine,paid_on,method,ref,note,proof_id,created) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      data.member.id,data.group.id,data.period,data.amount,data.fine,data.paid_on,data.method,data.ref,data.note,proofId,now());
    return { id: Number(result.lastInsertRowid), status: 'pending' };
  })));
  api.get('/payment-submissions', auth(), wrap(req => {
    const rows = all(`SELECT ${columns} ${joins} ORDER BY s.created DESC,s.id DESC`).filter(s => owned(req, s.member_id));
    return rows.map(row => ({ ...row, duplicate_warning: req.session.role === 'seller' && row.status === 'pending' ? duplicate(row, row.sha256, row.id) : undefined }));
  }));
  api.post('/payment-submissions/:id/review', seller, wrap(req => transaction(() => {
    const submission = one('SELECT * FROM payment_submissions WHERE id=?', Number(req.params.id));
    if (!submission) throw new HttpError(404, 'Submission not found.');
    if (submission.status !== 'pending') throw new HttpError(409, 'This submission has already been reviewed. Refresh the list.');
    const action = req.body.action;
    if (!['approve','reject'].includes(action)) bad('Choose approve or reject.');
    const note = str(req.body.review_note, 'Review note', { required: action === 'reject', max: 500 });
    let paymentId = null;
    if (action === 'approve') {
      if (req.body.transaction_verified !== true) bad('Confirm the transfer in your actual account before approving.');
      const data = validate(submission);
      const proof = one('SELECT sha256 FROM payment_proofs WHERE id=?', submission.proof_id);
      const conflict = duplicate(data, proof.sha256, submission.id);
      if (conflict) throw new HttpError(409, conflict);
      paymentId = insertPayment(data, submission.proof_id);
    }
    const status = action === 'approve' ? 'approved' : 'rejected';
    run('UPDATE payment_submissions SET status=?,reviewed_at=?,reviewed_by=?,review_note=?,payment_id=? WHERE id=?', status, now(), Number(req.session.ref), note, paymentId, submission.id);
    return { status, payment_id: paymentId };
  })));
  api.get('/payment-proofs/:id', auth(), (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const memberships = all('SELECT member_id FROM payment_submissions WHERE proof_id=? UNION SELECT member_id FROM payments WHERE proof_id=?', id, id);
      if (!memberships.some(m => owned(req, m.member_id))) throw new HttpError(404, 'Receipt not found.');
      const proof = one('SELECT * FROM payment_proofs WHERE id=?', id);
      if (!proof) throw new HttpError(404, 'Receipt not found.');
      res.setHeader('Content-Type', proof.mime);
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.send(Buffer.from(proof.image));
    } catch (error) { next(error); }
  });
  return { createPayment, backup: () => ({
    submissions: all('SELECT * FROM payment_submissions'),
    proofs: all('SELECT * FROM payment_proofs').map(({ image, ...proof }) => ({ ...proof, data: Buffer.from(image).toString('base64') })),
  }) };
};
