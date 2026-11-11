// Paluwagan ledger engine: due dates, grace periods, fines and member summaries.
// All dates are plain 'YYYY-MM-DD' strings in Asia/Manila time; months are 'YYYY-MM'.

const pad = (n) => String(n).padStart(2, '0');

function todayStr() {
  if (process.env.PALU_TODAY) return process.env.PALU_TODAY; // for testing only
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}

function addMonths(ym, k) {
  let [y, m] = ym.split('-').map(Number);
  const idx = y * 12 + (m - 1) + k;
  y = Math.floor(idx / 12);
  m = (idx % 12) + 1;
  return `${y}-${pad(m)}`;
}

function lastDay(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function dueDate(ym) {
  return `${ym}-${pad(lastDay(ym))}`;
}

function addDays(dateStr, d) {
  const [y, m, dd] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd + d)).toISOString().slice(0, 10);
}

// b - a in days
function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

const round2 = (n) => Math.round(n * 100) / 100;

function groupPeriods(group) {
  const out = [];
  for (let i = 0; i < group.slots; i++) {
    const ym = addMonths(group.start_month, i);
    const due = dueDate(ym);
    out.push({ index: i + 1, period: ym, due, deadline: addDays(due, group.grace_days) });
  }
  return out;
}

function fineFor(group, deadline, date) {
  const days = daysBetween(deadline, date);
  if (days <= 0) return { fine: 0, days: 0 };
  return { fine: round2(Number(group.fine_amount) + Number(group.fine_per_day) * days), days };
}

/**
 * Compute every period's status for a member.
 * status: paid | late | current | grace | overdue | future
 */
function computeMember(group, member, payments, waivers, payout, today = todayStr()) {
  const monthly = Number(group.monthly);
  const mine = payments.filter((p) => p.member_id === member.id);
  const waived = new Set(waivers.filter((w) => w.member_id === member.id).map((w) => w.period));
  const currentYm = today.slice(0, 7);

  const periods = groupPeriods(group).map((pr) => {
    const ps = mine.filter((p) => p.period === pr.period).sort((a, b) => (a.paid_on < b.paid_on ? -1 : a.paid_on > b.paid_on ? 1 : a.id - b.id));
    let acc = 0;
    let completedOn = null;
    for (const p of ps) {
      acc += Number(p.amount);
      if (!completedOn && acc >= monthly - 0.005) completedOn = p.paid_on;
    }
    const paid = round2(acc);
    const finePaid = round2(ps.reduce((s, p) => s + Number(p.fine || 0), 0));
    let status;
    let fineDue = 0;
    let lateDays = 0;
    if (completedOn) {
      const f = fineFor(group, pr.deadline, completedOn);
      status = f.days > 0 ? 'late' : 'paid';
      fineDue = f.fine;
      lateDays = f.days;
    } else if (pr.period > currentYm) {
      status = 'future';
    } else if (today <= pr.due) {
      status = 'current';
    } else if (today <= pr.deadline) {
      status = 'grace';
    } else {
      const f = fineFor(group, pr.deadline, today);
      status = 'overdue';
      fineDue = f.fine;
      lateDays = f.days;
    }
    const isWaived = waived.has(pr.period);
    if (isWaived) fineDue = 0;
    return {
      ...pr,
      status,
      paid,
      balance: round2(Math.max(0, monthly - paid)),
      finePaid,
      fineDue,
      fineBalance: round2(Math.max(0, fineDue - finePaid)),
      lateDays,
      waived: isWaived,
      completedOn,
      payments: ps,
      isPayout: pr.index === member.payout_order,
    };
  });

  const paidCount = periods.filter((p) => p.status === 'paid' || p.status === 'late').length;
  const dueNow = periods.filter((p) => ['current', 'grace', 'overdue'].includes(p.status));
  const overdue = periods.filter((p) => p.status === 'overdue');
  const grace = periods.filter((p) => p.status === 'grace');
  const next = periods.find((p) => p.status !== 'paid' && p.status !== 'late') || null;
  const payoutPeriod = member.payout_order ? addMonths(group.start_month, member.payout_order - 1) : null;

  let health = 'good';
  if (overdue.length) health = 'overdue';
  else if (grace.length) health = 'grace';
  else if (paidCount === periods.length) health = 'complete';

  return {
    periods,
    summary: {
      paidCount,
      totalPeriods: periods.length,
      totalPaid: round2(mine.reduce((s, p) => s + Number(p.amount), 0)),
      totalFinesPaid: round2(mine.reduce((s, p) => s + Number(p.fine || 0), 0)),
      outstanding: round2(dueNow.reduce((s, p) => s + p.balance, 0)),
      fineBalance: round2(periods.reduce((s, p) => s + p.fineBalance, 0)),
      overdueCount: overdue.length,
      graceCount: grace.length,
      next: next ? { period: next.period, due: next.due, deadline: next.deadline, balance: next.balance, status: next.status, fineDue: next.fineBalance } : null,
      payoutPeriod,
      payoutReleased: !!payout,
      payout: payout || null,
      health,
      remaining: round2(monthly * periods.length - mine.reduce((s, p) => s + Number(p.amount), 0)),
    },
  };
}

module.exports = { todayStr, addMonths, lastDay, dueDate, addDays, daysBetween, groupPeriods, fineFor, computeMember, round2 };

