const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const monthlyDraws = require('../lib/monthly-draws');

test('Existing saved draws upgrade to revisioned attempt history without losing or duplicating results', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE pgroups(id INTEGER PRIMARY KEY);
      CREATE TABLE members(id INTEGER PRIMARY KEY);
      CREATE TABLE sellers(id INTEGER PRIMARY KEY,name TEXT);
      INSERT INTO pgroups VALUES(1); INSERT INTO members VALUES(1); INSERT INTO sellers VALUES(1,'Owner');
      CREATE TABLE monthly_draws(id INTEGER PRIMARY KEY,group_id INTEGER NOT NULL,period TEXT NOT NULL,member_id INTEGER NOT NULL,
        winner_name TEXT NOT NULL,eligible_snapshot TEXT NOT NULL,collection_snapshot TEXT NOT NULL,source TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT '',seller_id INTEGER NOT NULL,created TEXT NOT NULL,UNIQUE(group_id,period),UNIQUE(group_id,member_id));
      INSERT INTO monthly_draws VALUES(1,1,'2026-11',1,'Existing winner','[{"id":1,"name":"Existing winner"}]','[]','wheel','',1,'2026-11-13T01:00:00Z');`);
    const dependencies = { db, api: { get() {}, post() {} }, wrap: fn => fn };
    monthlyDraws(dependencies);
    assert.equal(db.prepare('SELECT revision FROM monthly_draws').get().revision, 1);
    const attempt = db.prepare('SELECT * FROM draw_attempts').get();
    assert.equal(attempt.winner_name, 'Existing winner');
    assert.equal(attempt.revision, 1);
    assert.equal(attempt.request_id, 'initial:1');
    monthlyDraws(dependencies);
    assert.equal(db.prepare('SELECT COUNT(*) total FROM draw_attempts').get().total, 1);
  } finally { db.close(); }
});
