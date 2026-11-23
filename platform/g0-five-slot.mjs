const slotSize = [112, 112];
const plainImage = 100001;

export const sample = {
  name: 'G0FiveSlot',
  script: 'g0_five_slot',
  showCursor: true,
  blockCursor: true,
  controls: [
    ...[-320, -160, 0, 160, 320].map((x, index) => ({
      name: `Slot${index + 1}`,
      kind: 'container',
      position: [x, 24],
      size: slotSize,
      children: [
        { name: 'Face', kind: 'image', size: slotSize, image: plainImage, colour: '#344663' },
        { name: 'Hit', kind: 'cursorArea', size: slotSize },
      ],
    })),
    {
      name: 'InputMarker',
      kind: 'image',
      position: [0, -54],
      size: [88, 12],
      image: plainImage,
      colour: '#efc367',
      visible: false,
    },
  ],
};
