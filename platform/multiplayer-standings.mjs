import fs from 'node:fs';
import { group, image, label, pigment } from './m1-ui.mjs';

export const clearingColours = {
  sky: '#c4ddc9', grass: '#9cb778', ground: '#d3a969', ownLane: '#8ca76a', enemyLane: '#b2b379',
  farTrack: '#caad72', nearTrack: '#b68b53', recess: '#506b4c', teal: '#2d6260', ink: '#233936',
};

export function labelFront(name, position, content) {
  const front = label(name, position, [114, 32], content, 21, '#fff7de');
  Object.assign(front.text, { background: '#37634e', backgroundOpacity: 1 });
  return front;
}

export function onlineBadgePool() {
  const badge = (name, font, ink, background) => {
    const node = label(name, [0, 0], [52, 32], '', font, ink);
    Object.assign(node.text, { background, backgroundOpacity: 1, minFontSize: 16 });
    return { ...node, visible: false };
  };
  return group('BadgePool', [0, 0], [1064, 300], [
    ...Array.from({ length: 10 }, (_, index) => [
      badge(`Attack${index + 1}`, 21, '#233f49', '#d6ece5'),
      badge(`Life${index + 1}`, 21, '#75362d', '#f5dbd1'),
    ]).flat(),
    ...Array.from({ length: 5 }, (_, index) => badge(`Price${index + 1}`, 19, '#694321', '#fae0a2')),
  ], false);
}

// The mutually exclusive online views draw the same authored badges at their
// active slot anchors. No input listeners or game state are attached to them.
export const onlineBadgeSource = `
local function bind_online_badges(pool)
    if not pool then return nil end
    local source = pool.parent
    local index = pool:GetSiblingIndex()
    local impact = pool:GetChild("Price1")
    local state, fields = nil, {}
    local function set(control, value)
        local visible = value ~= nil
        if visible then control:SetActive(true); control.text = value end
        control:SetVisible(visible)
        if not visible then control:SetActive(false) end
    end
    for slot = 1, 10 do
        fields[slot] = {pool:GetChild("Attack" .. slot), pool:GetChild("Life" .. slot),
            slot > 5 and pool:GetChild("Price" .. (slot - 5)) or nil}
    end
    local function hide()
        if state then
            set(impact, nil)
            pool:SetVisible(false)
            pool:SetActive(false)
            state = nil
        end
    end
    local function place(field, stacked)
        local gap, width = 28, 52
        if state == "replay" then
            gap, width = 20, 38
            if stacked then gap, width = 0, 74 end
        end
        field[1]:SetSizeDelta(width, 32)
        field[2]:SetSizeDelta(width, 32)
        field[1]:SetAnchoredPosition(field.x - gap, field.y)
        field[2]:SetAnchoredPosition(field.x + gap, field.y - (stacked and 32 or 0))
        field.stacked = stacked
    end
    local function select(phase, parent, anchors)
        if state == phase then return end
        pool.parent = parent
        pool:SetAsLastSibling()
        state = phase
        for slot, field in ipairs(fields) do
            field.x, field.y, field.cue_x, field.cue_y = anchors(slot)
            place(field, false)
            if phase == "shop" and field[3] then field[3]:SetAnchoredPosition(field.cue_x, field.cue_y) end
            for _, control in ipairs(field) do set(control, nil) end
        end
        if phase == "shop" then
            impact:SetSizeDelta(52, 32)
            impact.bgColor, impact.fontColor = Color(250, 224, 162, 255), Color(105, 67, 33, 255)
        end
        pool:SetActive(true)
        pool:SetVisible(true)
    end
    local function paint(slot, attack, life, price, bonus)
        local field = fields[slot]
        local sign = bonus and "+" or ""
        if state == "replay" then
            local stacked = math.abs(attack or 0) >= 100 or math.abs(life or 0) >= 100
            if stacked ~= field.stacked then place(field, stacked) end
        end
        set(field[1], attack ~= nil and ("攻" .. sign .. attack) or nil)
        set(field[2], life ~= nil and ("命" .. sign .. life) or nil)
        if state == "shop" and field[3] then set(field[3], price ~= nil and (price .. " 金") or nil) end
    end
    local function feedback(slot, event)
        local field = slot and fields[slot]
        if state ~= "replay" then return end
        if not field or not event or event.type ~= "damage" then set(impact, nil); return end
        local blocked = event.amount == 0
        impact:SetSizeDelta(72, 32)
        impact:SetAnchoredPosition(field.cue_x, field.cue_y)
        impact.bgColor = blocked and Color(197, 222, 230, 255) or Color(251, 208, 150, 255)
        impact.fontColor = blocked and Color(41, 72, 90, 255) or Color(116, 46, 35, 255)
        set(impact, blocked and "格挡" or "-" .. event.amount)
    end
    return {select = select, hide = hide, paint = paint, feedback = feedback, restore = function()
        hide()
        if source and source.alive and pool.alive then
            pool.parent = source
            pool:SetSiblingIndex(index)
            pool:SetAnchoredPosition(0, 0)
        end
    end}
end
`;

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
