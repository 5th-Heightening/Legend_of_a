// The starting screen - the original mountain + tree scene.
Level.register({

    id: "meadow",
    name: "Meadow",

    exits: {
        left: null,
        right: "forest",
        up: null,
        down: null
    },

    parts: [
        {
            name: "mountain",
            z: 1,
            corners: {
                topLeft: { x: 12, y: 1 },
                topRight: { x: 20, y: 1 },
                bottomLeft: { x: 10, y: 2 },
                bottomRight: { x: 22, y: 2 }
            },
            ascii: String.raw`
    /\
 /\/ ,\
/______\
`,
            collisionFromAscii: true
        },
        {
            name: "tree",
            z: 10,
            corners: {
                topLeft: { x: 3, y: 4 },
                topRight: { x: 30, y: 4 },
                bottomLeft: { x: 6, y: 6 },
                bottomRight: { x: 33, y: 6 }
            },
            ascii: String.raw`
 /\
/##\
 ||
 ||
`,
            collisionFromAscii: true
        }
    ]
});
