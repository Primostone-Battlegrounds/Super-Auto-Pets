import fs from 'node:fs';
import { group, image, label, pigment } from './m1-ui.mjs';

const modes = {
  duel: { title: '好友 1v1', probeTitle: '双人同步样本', seats: 2,
    signal: 'AP_DuelSnapshot', refresh: 'AP_DuelRequest' },
  room: { title: '八席淘汰赛', probeTitle: '八席平台样本', seats: 8,
    signal: 'AP_EightProbeView', refresh: 'AP_EightProbeRequest' },
};
export function standingsLayout(mode, { position = [0, 0], probe = false, strip = false, themed = false } = {}) {
  const { title, probeTitle, seats } = modes[mode];
  const heading = probe ? probeTitle : title;
  const headerFill = themed ? '#315d57' : pigment.field;
  const headerInk = themed ? '#fff7de' : pigment.ink;
  const detailInk = themed ? '#3e5c56' : pigment.muted;
  const opponentInk = themed ? '#65441d' : '#206258';
  if (strip) {
    if (mode !== 'duel') throw new Error('Only the duel uses a standings strip');
    return group('Standings', position, [1000, 64], [
      image('Border', [0, 0], [1000, 64], pigment.edge),
      image('Paper', [0, 0], [994, 58], pigment.canvas),
      image('Header', [-400, 0], [174, 58], headerFill),
      label('Heading', [-400, 0], [165, 35], heading, 20, headerInk),
      label('Phase', [-187, 14], [225, 28], '等待关卡状态', 16, pigment.ink),
      label('Opponent', [-187, -14], [225, 26], '', 15, opponentInk),
      label('Count', [7, 0], [140, 26], '', 15, detailInk),
      ...[1, 2].flatMap((seat) => {
        const x = 178 + (seat - 1) * 210;
        return [
          image(`SeatSurface${seat}`, [x, 0], [196, 58], pigment.chip),
          label(`Seat${seat}`, [x, 14], [188, 28], '', 16, pigment.ink),
          label(`Seat${seat}Detail`, [x, -14], [188, 26], '', 15, detailInk),
        ];
      }),
    ]);
  }
  const height = 158 + seats * 56;
  const top = height / 2;
  return group('Standings', position, [248, height], [
    image('Border', [0, 0], [248, height], pigment.edge),
    image('Paper', [0, 0], [242, height - 6], pigment.canvas),
    image('Header', [0, top - 29], [224, 42], headerFill),
    label('Heading', [0, top - 29], [214, 36], heading, 22, headerInk),
    label('Phase', [0, top - 72], [222, 28], '等待关卡状态', 16, pigment.ink),
    label('Count', [0, top - 100], [222, 28], '', 15, detailInk),
    label('Opponent', [0, top - 127], [222, 28], '', 16, opponentInk),
    ...Array.from({ length: seats }, (_, index) => {
      const seat = index + 1;
      const y = top - 169 - index * 56;
      return [
        image(`SeatSurface${seat}`, [0, y - 3], [224, 56], themed && index % 2 === 1 ? '#f7eed7' : pigment.chip),
        label(`Seat${seat}`, [0, y + 10], [202, 28], '', themed ? 17 : 16, pigment.ink, 'left'),
        label(`Seat${seat}Detail`, [0, y - 17], [202, 26], '', 15, detailInk, 'left'),
      ];
    }).flat(),
  ]);
}

export function standingsRequest(mode) {
  return modes[mode].refresh;
}

export function standingsScript(mode, fields) {
  const { signal, refresh } = modes[mode];
  const allowed = mode === 'duel' ? [4, 7] : [1];
  if (!allowed.includes(fields)) throw new Error(`Unsupported ${mode} refresh arity ${fields}`);
  const module = fs.readFileSync(new URL('./multiplayer_standings.lua', import.meta.url), 'utf8');
  const request = '    request:AddInt(0)\n'.repeat(fields);
  return `local standings = (function()\n${module}\nend)()
local render

local function receive(_, fields)
    if render then render(standings.${mode}_probe(fields)) end
end

function OnStart()
    render = standings.bind(assert(script.object:GetChild('Standings')), '${mode}')
    script:RegisterServerSignalHandler('${signal}', receive)
    local request = game.ServerSignal('${refresh}')
${request}    request:SendSignal()
end

function OnDestroy()
    script:UnregisterServerSignalHandler('${signal}')
    render = nil
end
`;
}
