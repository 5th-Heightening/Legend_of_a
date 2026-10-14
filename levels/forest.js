// East of the meadow. The trees only block at their trunks - the
// canopy has its own collision map, so the player can walk behind it.
Level.register({

    id: "forest",
    name: "Forest",

    exits: {
        left: "meadow",
        right: null,
        up: null,
        down: null
    },

    parts: [
        {
            name: "hills",
            z: 1,
            corners: {
                topLeft: { x: 18, y: 1 },
                topRight: { x: 24, y: 1 },
                bottomLeft: { x: 16, y: 2 },
                bottomRight: { x: 26, y: 2 }
            },
            ascii: String.raw`
   __      _
 _/  \____/ \_
/             \
`,
            collisionFromAscii: true
        },
        {
            name: "big tree",
            z: 10,
            corners: {
                topLeft: { x: 8, y: 5 },
                topRight: { x: 36, y: 5 },
                bottomLeft: { x: 10, y: 8 },
                bottomRight: { x: 40, y: 8 }
            },
            ascii: String.raw`
  /\
 /##\
/####\
  ||
  ||
`,
            collisionFromAscii: false,
            collision: String.raw`



  ##
  ##
`
        },
        {
            name: "small tree",
            z: 11,
            corners: {
                topLeft: { x: 22, y: 11 },
                topRight: { x: 44, y: 11 },
                bottomLeft: { x: 24, y: 13 },
                bottomRight: { x: 48, y: 13 }
            },
            ascii: String.raw`
 /\
/##\
 ||
`,
            collisionFromAscii: false,
            collision: String.raw`


 ##
`
        }
    ]
});
