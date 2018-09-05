var scenes = {
    "Cerberus": {
        "mesh": "assets/Cerberus/cerberus.obj",
        "shader": "pbr",
        "size": "2,51 MB",
        "camera": {
            "eye": [1,0.5,-1],
            "target": [0,0,-0.5],
            "up": [0,1,0]
        },
        "useModel": true
    },
    "Golden": {
        "mesh": "assets/Golden/golden.obj",
        "shader": "pbr",
        "size": "0,84 MB",
        "camera": {
            "eye": [0,0,5],
            "target": [0,0,0],
            "up": [0,1,0]
        },
        "useModel": true
    },
    "Lantern": {
        "mesh": "assets/Lantern/lantern.obj",
        "shader": "pbr",
        "size": "1,94 MB",
        "camera": {
            "eye": [-25,80,150],
            "target": [0,30,0],
            "up": [0,1,0]
        },
        "useModel": true,
        "hasOpacity": true
    },
    "Blaster": {
        "mesh": "assets/Blaster/blaster.obj",
        "shader": "pbr",
        "size": "3,6 MB",
        "camera": {
            "eye": [-10,3.6,-8],
            "target": [-1.15,0.3,-1],
            "up": [0,1,0]
        },
        "useModel": true,
        "isEmissive": true
    },
    // "Helmet": {
    //     "mesh": "assets/Helmet/helmet.obj",
    //     "shader": "pbr",
    //     "size": "0,18 MB",
    //     "camera": {
    //         "eye": [0.03374031186103821, 0.0017393999733030796, 0.03702479600906372],
    //         "target": [-1.15,0.3,-1],
    //         "up": [0,1,0]
    //     },
    //     "useModel": true,
    //     "isEmissive": true
    // },
    "AirConditioner": {
        "mesh": "assets/AirConditioner/AirConditioner.obj",
        "shader": "pbr",
        "size": "0,04 MB",
        "camera": {
            "eye": [-80,35,20],
            "target": [20,30,-50],
            "up": [0,1,0]
        },
        "useModel": true
    },
    "Sphere": {
        "mesh": "sphere",
        "shader": "pbrMat",
        "uniforms": {
            // "u_albedo": vec3.fromValues( 0.92, 0.5, 0.1),
            "u_roughness": 0.0,
            "u_metalness": 0.0
        },
        "camera": {
            "eye": [0,0,5],
            "target": [0,0,0],
            "up": [0,1,0]
        },
        "useModel": true
    },
    "Matrix": {
        "camera": {
            "eye": [0,10,25],
            "target": [10,0,10],
            "up": [0,1,0]
        }
    },
    "Roughness scale": {
        "camera": {
            "eye": [13.81, 0.24,8.38],
            "target": [0,0,8],
            "up": [0,1,0]
        }
    },
    "Metalness scale": {
        "camera": {
            "eye": [13.81, 0.24,8.38],
            "target": [0,0,8],
            "up": [0,1,0]
        }
    }
}