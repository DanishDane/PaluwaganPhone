const crypto = require('node:crypto');

module.exports = function monthlyDraws({ db, L, api, seller, wrap, HttpError, bad, str, groupOr404, memberOr404, now }) {
  const one = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args).map(row => ({ ...row }));
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  db.exec(`CREATE TABLE IF NOT EXISTS monthly_draws (
    id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL REFERENCES pgroups(id),
    period TEXT NOT NULL, member_id INTEGER NOT NULL REFERENCES members(id), winner_name TEXT NOT NULL,
    eligible_snapshot TEXT NOT NULL, collection_snapshot TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('wheel','messenger')), reason TEXT NOT NULL DEFAULT '',
    seller_id INTEGER NOT NULL REFERENCES sellers(id), created TEXT NOT NULL,
    UNIQUE(group_id, period), UNIQUE(group_id, member_id));
    CREATE TABLE IF NOT EXISTS release_audit (
      id INTEGER PRIMARY KEY, group_id INTEGER NOT NULL, member_id INTEGER NOT NULL,
      action TEXT NOT NULL, reason TEXT NOT NULL, previous TEXT, seller_id INTEGER NOT NULL, created TEXT NOT NULL);`);
  if (!all('PRAGMA table_info(monthly_draws)').some(column => column.name === 'revision')) db.exec('ALTER TABLE monthly_draws ADD COLUMN revision INTEGER NOT NULL DEFAULT 1');
  db.exec(`CREATE TABLE IF NOT EXISTS draw_attempts (
    id INTEGER PRIMARY KEY, draw_id INTEGER NOT NULL REFERENCES monthly_draws(id), revision INTEGER NOT NULL,
    member_id INTEGER NOT NULL, winner_name TEXT NOT NULL, eligible_snapshot TEXT NOT NULL, collection_snapshot TEXT NOT NULL,
    source TEXT NOT NULL, reason TEXT NOT NULL, seller_id INTEGER NOT NULL REFERENCES sellers(id), created TEXT NOT NULL,
    request_id TEXT NOT NULL UNIQUE, UNIQUE(draw_id,revision));
    INSERT INTO draw_attempts(draw_id,revision,member_id,winner_name,eligible_snapshot,collection_snapshot,source,reason,seller_id,created,request_id)
    SELECT d.id,d.revision,d.member_id,d.winner_name,d.eligible_snapshot,d.collection_snapshot,d.source,d.reason,d.seller_id,d.created,'initial:' || d.id
    FROM monthly_draws d WHERE NOT EXISTS(SELECT 1 FROM draw_attempts a WHERE a.draw_id=d.id);`);

  const decode = row => row ? { ...row, eligible: JSON.parse(row.eligible_snapshot), collection: JSON.parse(row.collection_snapshot) } : null;
  const transaction = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  function state(groupId, requestedPeriod) {
    const group = groupOr404(groupId);
    const today = L.todayStr();
    const current = today.slice(0, 7);
    const periods = L.groupPeriods(group).map(item => item.period);
    const available = periods.filter(period => period <= current);
    const period = requestedPeriod || (periods.includes(current) ? current : available.at(-1) || periods[0]);
    if (!periods.includes(period)) bad('Choose a valid draw month for this group.');
    const members = all('SELECT id,name,payout_order FROM members WHERE group_id=? ORDER BY id', group.id);
    const history = all('SELECT d.*,s.name AS seller_name,p.released_on FROM monthly_draws d JOIN sellers s ON s.id=d.seller_id LEFT JOIN payouts p ON p.member_id=d.member_id WHERE d.group_id=? ORDER BY d.period DESC', group.id).map(decode);
    const releases = all('SELECT p.*,m.name AS member FROM payouts p JOIN members m ON m.id=p.member_id WHERE p.group_id=?', group.id);
    const excluded = new Set([...history.map(draw => draw.member_id), ...releases.map(payout => payout.member_id)]);
    const messengerEligible = members.filter(member => !excluded.has(member.id));
    const payments = all('SELECT * FROM payments WHERE group_id=? AND paid_on<=?', group.id, today);
    const waivers = all('SELECT * FROM waivers WHERE member_id IN (SELECT id FROM members WHERE group_id=?)', group.id);
    const collection = members.map(member => {
      const payment = L.computeMember(group, member, payments, waivers, null, today).periods.find(item => item.period === period);
      return { id: member.id, name: member.name, paid: payment.paid, balance: payment.balance, fine_balance: payment.fineBalance, complete: payment.balance < .005 && payment.fineBalance < .005 };
    });
    const draw = history.find(draw => draw.period === period) || null;
    const paidIds = new Set(collection.filter(member => member.complete).map(member => member.id));
    const eligible = messengerEligible.filter(member => paidIds.has(member.id));
    const otherWinners = new Set([...history.filter(item => item.id !== draw?.id).map(item => item.member_id), ...releases.map(item => item.member_id)]);
    const rerollEligible = members.filter(member => paidIds.has(member.id) && !otherWinners.has(member.id));
    const legacy = releases.find(payout => payout.period === period && !history.some(draw => draw.member_id === payout.member_id));
    const blockers = [];
    if (period > current) blockers.push('This month has not started yet.');
    if (!eligible.length) blockers.push('No eligible paid members. Verify at least one member’s monthly hulog and required fines.');
    if (legacy) blockers.push('A previously recorded release already occupies this month.');
    if (draw) blockers.push('The winner for this month is already saved.');
    const releaseAudit = all('SELECT a.*,s.name AS seller_name FROM release_audit a JOIN sellers s ON s.id=a.seller_id WHERE a.group_id=? ORDER BY a.id DESC', group.id);
    const attempts = all('SELECT a.*,s.name AS seller_name FROM draw_attempts a JOIN monthly_draws d ON d.id=a.draw_id JOIN sellers s ON s.id=a.seller_id WHERE d.group_id=? ORDER BY a.id DESC', group.id).map(decode);
    const canSpinAgain = !!draw && !draw.released_on && !releases.some(item => item.period === period) && period <= current && rerollEligible.length > 0;
    return { group: { id: group.id, name: group.name, model: group.model, slots: group.slots, monthly: group.monthly }, period, current_period: current, periods, eligible, messenger_eligible: messengerEligible, reroll_eligible: rerollEligible, attempts, can_spin_again: canSpinAgain, history, releases, release_audit: releaseAudit, draw, collection, unpaid_count: collection.filter(member => !member.complete).length, paid_count: collection.filter(member => member.complete).length, expected: L.round2(group.monthly * group.slots), collected: L.round2(collection.reduce((total, member) => total + member.paid, 0)), blockers, can_spin: blockers.length === 0 };
  }
  function recordAttempt(draw, requestId) {
    run('INSERT INTO draw_attempts(draw_id,revision,member_id,winner_name,eligible_snapshot,collection_snapshot,source,reason,seller_id,created,request_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)', draw.id, draw.revision, draw.member_id, draw.winner_name, draw.eligible_snapshot, draw.collection_snapshot, draw.source, draw.reason, draw.seller_id, draw.created, requestId);
  }
  function save(snapshot, member, source, reason, sellerId) {
    const id = Number(run('INSERT INTO monthly_draws(group_id,period,member_id,winner_name,eligible_snapshot,collection_snapshot,source,reason,seller_id,created) VALUES(?,?,?,?,?,?,?,?,?,?)', snapshot.group.id, snapshot.period, member.id, member.name, JSON.stringify(snapshot.eligible), JSON.stringify(snapshot.collection), source, reason, sellerId, now()).lastInsertRowid);
    const draw = one('SELECT * FROM monthly_draws WHERE id=?', id);
    recordAttempt(draw, `initial:${id}`);
    return decode(draw);
  }
  api.get('/groups/:id/draws', seller, wrap(req => state(req.params.id, req.query.period)));
  api.post('/groups/:id/draws', seller, wrap(req => transaction(() => {
    const snapshot = state(req.params.id, req.body?.period);
    // Retrying a completed request returns its saved result; it never draws again.
    if (snapshot.draw) return { draw: snapshot.draw, existing: true };
    if (!snapshot.can_spin) throw new HttpError(409, snapshot.blockers.join(' '));
    if (req.body?.confirm_draw !== true) bad('Confirm that you want to save this month’s draw.');
    const winner = snapshot.eligible[crypto.randomInt(snapshot.eligible.length)];
    return { draw: save(snapshot, winner, 'wheel', '', Number(req.session.ref)), existing: false };
  })));
  api.post('/groups/:id/draws/spin-again', seller, wrap(req => transaction(() => {
    const snapshot = state(req.params.id, req.body?.period);
    if (!snapshot.draw) bad('Save an initial draw before spinning again.');
    const requestId = String(req.body?.request_id || '');
    if (!/^[a-f0-9]{32}$/.test(requestId)) bad('A valid spin request identifier is required.');
    const previous = one('SELECT * FROM draw_attempts WHERE request_id=?', requestId);
    if (previous) {
      if (previous.draw_id !== snapshot.draw.id || previous.revision !== Number(req.body.expected_revision) + 1) throw new HttpError(409, 'This request identifier belongs to another spin.');
      return { draw: snapshot.draw, existing: true };
    }
    if (Number(req.body.expected_revision) !== snapshot.draw.revision) throw new HttpError(409, 'Another spin changed this result. Refresh before spinning again.');
    if (!snapshot.can_spin_again) throw new HttpError(409, 'Cannot spin again after release, for a future month, or without eligible paid members.');
    if (req.body.confirm_spin_again !== true) bad('Confirm that this spin replaces the current unreleased winner.');
    const reason = str(req.body.reason, 'Reason for spinning again', { max: 500 });
    const winner = snapshot.reroll_eligible[crypto.randomInt(snapshot.reroll_eligible.length)];
    run("UPDATE monthly_draws SET member_id=?,winner_name=?,eligible_snapshot=?,collection_snapshot=?,source='wheel',reason=?,seller_id=?,created=?,revision=revision+1 WHERE id=?", winner.id, winner.name, JSON.stringify(snapshot.reroll_eligible), JSON.stringify(snapshot.collection), reason, Number(req.session.ref), now(), snapshot.draw.id);
    const draw = one('SELECT * FROM monthly_draws WHERE id=?', snapshot.draw.id);
    recordAttempt(draw, requestId);
    return { draw: decode(draw), existing: false };
  })));
  api.post('/groups/:id/draws/messenger', seller, wrap(req => transaction(() => {
    const snapshot = state(req.params.id, req.body?.period);
    if (snapshot.draw || snapshot.releases.some(release => release.period === snapshot.period)) throw new HttpError(409, 'This month already has a winner or release.');
    if (snapshot.period > snapshot.current_period) bad('Existing Messenger results must be for the current month or an earlier group month.');
    if (req.body?.confirm_existing_result !== true) bad('Confirm that this winner was already selected in Messenger.');
    const reason = str(req.body.reason, 'Reason / Messenger result details', { max: 500 });
    const member = snapshot.messenger_eligible.find(member => member.id === Number(req.body.member_id));
    if (!member) bad('Choose a member who has not already won or received an iPhone.');
    return { draw: save({ ...snapshot, eligible: snapshot.messenger_eligible }, member, 'messenger', reason, Number(req.session.ref)) };
  })));
  function release(body, sellerId) {
    return transaction(() => {
      const member = memberOr404(body.member_id);
      const draw = one('SELECT * FROM monthly_draws WHERE member_id=?', member.id);
      if (!draw) bad('Select this member in a monthly draw or record their existing Messenger result before releasing.');
      if (one('SELECT id FROM payouts WHERE member_id=?', member.id)) throw new HttpError(409, 'This member has already received their iPhone.');
      const date = String(body.released_on || L.todayStr());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date + 'T00:00:00Z')) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date || date > L.todayStr() || date.slice(0, 7) < draw.period) bad('Choose a valid release date on or after the draw month, and not in the future.');
      const imei = str(body.imei, 'IMEI / Serial', { required: false, max: 40 });
      const note = str(body.note, 'Note', { required: false, max: 300 });
      run('INSERT INTO payouts(group_id,member_id,period,released_on,imei,note) VALUES(?,?,?,?,?,?)', member.group_id, member.id, draw.period, date, imei, note);
      run('INSERT INTO release_audit(group_id,member_id,action,reason,previous,seller_id,created) VALUES(?,?,?,?,?,?,?)', member.group_id, member.id, 'release', note, JSON.stringify({ released_on: date, imei }), sellerId, now());
      return { ok: true };
    });
  }
  function undoRelease(memberId, body, sellerId) {
    return transaction(() => {
      const payout = one('SELECT * FROM payouts WHERE member_id=?', Number(memberId));
      if (!payout) throw new HttpError(404, 'Release not found.');
      const reason = str(body?.reason, 'Reason for correcting the release', { max: 500 });
      // Preserve a legacy winner before undoing an old release, so they cannot win again.
      if (!one('SELECT id FROM monthly_draws WHERE member_id=?', payout.member_id)) {
        const snapshot = state(payout.group_id, payout.period);
        if (snapshot.draw) bad('This legacy release conflicts with another saved draw. Contact the administrator before correcting it.');
        const member = memberOr404(payout.member_id);
        snapshot.eligible.push({ id: member.id, name: member.name, payout_order: member.payout_order });
        save(snapshot, member, 'messenger', `Legacy release correction: ${reason}`, sellerId);
      }
      run('INSERT INTO release_audit(group_id,member_id,action,reason,previous,seller_id,created) VALUES(?,?,?,?,?,?,?)', payout.group_id, payout.member_id, 'undo_release', reason, JSON.stringify(payout), sellerId, now());
      run('DELETE FROM payouts WHERE member_id=?', payout.member_id);
      return { ok: true };
    });
  }
  return { state, release, undoRelease };
};
