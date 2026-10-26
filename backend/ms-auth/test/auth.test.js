const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const repo = require('../src/repositories/user.repository');
const User = require('../src/models/user.model');
const app = require('../src/app');

test('registro, login y ruta protegida por HTTP', async t => {
  const original = { createUser: repo.createUser, findCredentialsByEmail: repo.findCredentialsByEmail, findById: repo.findById };
  let stored;
  repo.createUser = async data => {
    if (stored) throw Object.assign(new Error('duplicate'), { code: 11000 });
    stored = new User({ ...data, password: data.passwordHash });
    await stored.validate();
    return stored;
  };
  repo.findCredentialsByEmail = async email => stored?.email === email.trim().toLowerCase() ? stored : null;
  repo.findById = async id => stored && String(stored._id) === id ? stored : null;
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {Object.assign(repo, original); await new Promise(resolve => server.close(resolve));});
  const call = async (path, body, token) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth${path}`, {
      method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', ...(token ? {authorization:`Bearer ${token}`} : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return {status: response.status, body: await response.json()};
  };
  assert.equal((await call('/register', {})).status, 400);
  for (const body of [null, [], { email: 42 }]) {
    assert.equal((await call('/register', body)).status, 400);
    assert.equal((await call('/login', body)).status, body === null ? 400 : 401);
  }
  const input = {email:'Alex@example.com',username:'Alex',name:'Alex Name',password:'password123',role:'ADMIN'};
  const registered = await call('/register', input);
  assert.equal(registered.status, 201);
  assert.equal(registered.body.user.email, 'alex@example.com');
  assert.equal(registered.body.user.name, 'Alex Name');
  assert.equal(registered.body.user.role, 'USER');
  assert.equal(registered.body.user.password, undefined);
  assert.ok(await bcrypt.compare(input.password, stored.password));
  assert.equal((await call('/register', input)).status, 409);
  assert.equal((await call('/login', {email:input.email,password:'wrong'})).status, 401);
  const logged = await call('/login', {email:input.email,password:input.password});
  assert.equal(logged.status, 200);
  assert.equal(logged.body.user.password, undefined);
  assert.equal(jwt.decode(logged.body.token, {complete:true}).header.alg, 'RS256');
  assert.equal((await call('/me')).status, 401);
  assert.equal((await call('/me', undefined, 'invalid')).status, 401);
  assert.equal((await call('/me', undefined, jwt.sign({sub:String(stored._id)}, 'wrong-key'))).status, 401);
  const me = await call('/me', undefined, logged.body.token);
  assert.equal(me.status, 200);
  assert.equal(me.body.user._id, String(stored._id));
  stored.accountStatus = 'BANNED';
  assert.equal((await call('/login', {email:input.email,password:input.password})).status, 403);
  assert.equal((await call('/me', undefined, logged.body.token)).status, 403);
  stored.accountStatus = 'SUSPENDED';
  stored.suspendedUntil = new Date(Date.now() + 60_000);
  assert.equal((await call('/me', undefined, logged.body.token)).status, 403);
  stored.suspendedUntil = null;
  assert.equal((await call('/me', undefined, logged.body.token)).status, 403);
  stored.suspendedUntil = new Date(Date.now() - 60_000);
  assert.equal((await call('/me', undefined, logged.body.token)).status, 200);
  stored = null;
  assert.equal((await call('/me', undefined, logged.body.token)).status, 401);
  assert.equal((await call('/missing')).status, 404);
});
