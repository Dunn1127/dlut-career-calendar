import test from 'node:test';
import assert from 'node:assert/strict';
import {resilientStorage} from '../site/lib/storage.mjs';

test('浏览器配额耗尽时仍能收藏，并明确暴露非持久状态', () => {
  const source = {getItem: () => '["旧收藏"]', setItem: () => {throw new Error('quota');}};
  const storage = resilientStorage(source);
  assert.equal(storage.getItem('favorites'), '["旧收藏"]');
  storage.setItem('favorites', '["旧收藏","新收藏"]');
  assert.equal(storage.persistent, false);
  assert.equal(storage.getItem('favorites'), '["旧收藏","新收藏"]');
});

test('浏览器禁用存储时不影响本次页面会话', () => {
  const storage = resilientStorage(null);
  storage.setItem('favorites', '[]');
  assert.equal(storage.getItem('favorites'), '[]');
  assert.equal(storage.persistent, false);
});
