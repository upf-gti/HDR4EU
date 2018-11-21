var assets_folder = "assets/";
var textures_folder = "textures/sphere_maps/";

var scenes = {
    "Pbr": {
        "name": "Pbr",
        "mesh": assets_folder + "Pbr/pbr.wbin",
        "textures": {
            'roughness': assets_folder + "Pbr/roughness.png",
            'metalness': assets_folder + "Pbr/metalness.png",
            'albedo': assets_folder + "Pbr/albedo.png",
            'normal': assets_folder + "Pbr/normal.png",
            'ao': assets_folder + "Pbr/ao.png",
            'height': assets_folder + "Pbr/height.png"
        },
        "shader": "pbr",
        "size": "7,28 MB",
        "camera": {
            "eye": [0,65,387]
        }
    },
    "Lantern": {
        "name": "Lantern",
        "mesh": assets_folder + "Lantern/lantern.obj",
        "textures": {
            'roughness': assets_folder + "Lantern/roughness.png",
            'metalness': assets_folder + "Lantern/metalness.png",
            'albedo': assets_folder + "Lantern/albedo.png",
            'normal': assets_folder + "Lantern/normal.png",
            'ao': assets_folder + "Lantern/ao.png",
            'opacity': assets_folder + "Lantern/opacity.png",
        },
        "shader": "pbr",
        "size": "1,94 MB",
        "camera": {
            "eye": [-25,80,150],
            "target": [0,30,0]
        }
    },
    "Blaster": {
        "name": "Blaster",
        "mesh": assets_folder + "Blaster/blaster.obj",
        "textures": {
            'roughness': assets_folder + "Blaster/roughness.png",
            'metalness': assets_folder + "Blaster/metalness.png",
            'albedo': assets_folder + "Blaster/albedo.png",
            'normal': assets_folder + "Blaster/normal.png",
            'ao': assets_folder + "Blaster/ao.png",
            'emissive': assets_folder + "Blaster/emissive.png",
        },
        "shader": "pbr",
        "size": "3,6 MB",
        "camera": {
            "eye": [-10,3.6,-8]
        }
    },
    "Golden ball": {
        "name": "Golden ball",
        "mesh": assets_folder + "Golden/golden.obj",
        "textures": {
            'roughness': assets_folder + "Golden/roughness.png",
            'metalness': assets_folder + "Golden/metalness.png",
            'albedo': assets_folder + "Golden/albedo.png",
            'normal': assets_folder + "Golden/normal.png",
            'ao': assets_folder + "Golden/ao.png",
        },
        "shader": "pbr",
        "size": "0,8 MB",
    },
    "JetPrince 1967": {
        "name": "JetPrince 1967",
        "mesh": [
            assets_folder + "Bike/bike1/bike1.obj",
            assets_folder + "Bike/bike2/bike2.obj",
            assets_folder + "Bike/bike3/bike3.obj",
            assets_folder + "Bike/bike4/bike4.obj",
        ],
        "textures": [
            {
                'roughness': assets_folder + "Bike/bike1/roughness.png",
                'metalness': assets_folder + "Bike/bike1/metalness.png",
                'albedo': assets_folder + "Bike/bike1/albedo.png",
                'normal': assets_folder + "Bike/bike1/normal.png",
                'ao': assets_folder + "Bike/bike1/ao.png"
            },
            {
                'roughness': assets_folder + "Bike/bike2/roughness.png",
                'metalness': assets_folder + "Bike/bike2/metalness.png",
                'albedo': assets_folder + "Bike/bike2/albedo.png",
                'normal': assets_folder + "Bike/bike2/normal.png",
                'ao': assets_folder + "Bike/bike2/ao.png"
            },
            {
                'roughness': assets_folder + "Bike/bike3/roughness.png",
                'metalness': assets_folder + "Bike/bike3/metalness.png",
                'albedo': assets_folder + "Bike/bike3/albedo.png",
                'normal': assets_folder + "Bike/bike3/normal.png",
                'ao': assets_folder + "Bike/bike3/ao.png"
            },
            {
                'roughness': assets_folder + "Bike/bike4/roughness.png",
                'metalness': assets_folder + "Bike/bike4/metalness.png",
                'albedo': assets_folder + "Bike/bike4/albedo.png",
                'normal': assets_folder + "Bike/bike4/normal.png",
                'ao': assets_folder + "Bike/bike4/ao.png",
                'opacity': assets_folder + "Bike/bike4/opacity.png",
            }
        ],
        "shader": "pbr",
        "size": "10,2 MB",
        "camera": {
            "eye": [2.5,1.5,3]
        },
        "node_name": "multipart_node"
    },
    "Iron Man helmet": {
        "name": "Iron Man helmet",
        "mesh": [
            assets_folder + "IronMan/helmet/helmet.obj",
            assets_folder + "IronMan/base/base.obj",
        ],
        "textures": [
            {
                'roughness': assets_folder + "IronMan/helmet/roughness.png",
                'metalness': assets_folder + "IronMan/helmet/metalness.png",
                'albedo': assets_folder + "IronMan/helmet/albedo.png",
                'normal': assets_folder + "IronMan/helmet/normal.png",
                'ao': assets_folder + "IronMan/helmet/ao.png",
                'emissive': assets_folder + "IronMan/helmet/emissive.png"
            },
            {
                'roughness': assets_folder + "IronMan/base/roughness.png",
                'metalness': assets_folder + "IronMan/base/metalness.png",
                'albedo': assets_folder + "IronMan/base/albedo.png",
                'normal': assets_folder + "IronMan/base/normal.png",
                'ao': assets_folder + "IronMan/base/ao.png"
            }
        ],
        "shader": "pbr",
        "size": "2,51 MB",
    },
    "Cerberus": {
        "name": "Cerberus",
        "mesh": assets_folder + "Cerberus/cerberus.wbin",
        "textures": {
            'roughness': assets_folder + "Cerberus/roughness.png",
            'metalness': assets_folder + "Cerberus/metalness.png",
            'albedo': assets_folder + "Cerberus/albedo.png",
            'normal': assets_folder + "Cerberus/normal.png",
            'ao': assets_folder + "Cerberus/ao.png"
        },
        "shader": "pbr",
        "size": "2,51 MB",
        "camera": {
            "eye": [1,0.5,-1],
            "target": [0,0,-0.5]
        }
    },
    "AirConditioner": {
        "name": "AirConditioner",
        "mesh": assets_folder + "AirConditioner/AirConditioner.obj",
        "textures": {
            'roughness': assets_folder + "AirConditioner/roughness.png",
            'metalness': assets_folder + "AirConditioner/metalness.png",
            'albedo': assets_folder + "AirConditioner/albedo.png",
            'normal': assets_folder + "AirConditioner/normal.png",
            'ao': assets_folder + "AirConditioner/ao.png"
        },
        "shader": "pbr",
        "size": "0,04 MB",
        "camera": {
            "eye": [-80,35,20],
            "target": [0,20,-40]
        }
    },
    "Matrix": {
        "name": "Matrix",
        "node_name": "matrix_node",
        "camera": {
            "eye": [0,10,25],
            "target": [7,0,7]
        }
    },
    "Roughness scale": {
        "name": "Roughness scale",
        "node_name": "roughness_scale_node",
        "camera": {
            "eye": [13.81, 0.24,8.38],
            "target": [0,0,8]
        }
    },
    "Metalness scale": {
        "name": "Metalness scale",
        "node_name": "metalness_scale_node",
        "camera": {
            "eye": [13.81, 0.24,8.38],
            "target": [0,0,8]
        }
    }
}
