/// <reference types="genshin-ts" />
import { defineSignal } from 'genshin-ts/runtime/core';

const roomRequest = defineSignal('AP_RoomRequest', [
  ['action', 'int'], ['round', 'int'], ['sequence', 'int'],
  ['from', 'int'], ['to', 'int'], ['flag', 'int'], ['token', 'int'],
] as const);
const roomView = defineSignal('client:AP_RoomView', [
  ['player', 'entity'], ['revision', 'int'], ['phase', 'int'], ['round', 'int'], ['seat', 'int'],
  ['nextSequence', 'int'], ['humanCount', 'int'], ['winner', 'int'], ['ready', 'bool'],
  ['lives', 'int_list'], ['places', 'int_list'], ['opponents', 'int_list'], ['results', 'int_list'], ['market', 'int_list'],
  ['ack', 'int'], ['remaining', 'int'],
] as const);
const roomBoard = defineSignal('client:AP_RoomBattle', [
  ['player', 'entity'], ['frame', 'int'], ['round', 'int'], ['left', 'int'], ['right', 'int'],
  ['outcome', 'int'], ['board', 'int_list'],
] as const);
const roomReplay = defineSignal('client:AP_RoomReplay', [
  ['player', 'entity'], ['round', 'int'], ['left', 'int'], ['right', 'int'], ['outcome', 'int'],
  ['seed', 'int'], ['first', 'int_list'], ['second', 'int_list'],
] as const);

const roomFightWork = defineSignal('AP_RoomFightWork', [
  ['ticket', 'int'], ['round', 'int'], ['frame', 'int'], ['pair', 'int'],
  ['flags', 'int'], ['seed', 'int'], ['first', 'int_list'], ['second', 'int_list'],
] as const);
const roomFightDone = defineSignal('AP_RoomFightDone', [
  ['ticket', 'int'], ['round', 'int'], ['frame', 'int'], ['pair', 'int'], ['flags', 'int'],
  ['outcome', 'int'], ['board', 'int_list'],
] as const);
