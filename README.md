# H2020 HDR4EU Project

HDR4EU is a EU project related to HDR data. This repository contains a set of web-tools, libraries and fileformat descriptions developed by the GTI group from Universitat Pompeu Fabra to tackle existing problems of using HDR images on the web.

More specifically, in this repository you will find a web-tool renderer which can achieve photorealistic results and match real lighting conditions taking advantage of the use of image-based HDR lighting. For this purpose, we have determined the environment file format used, called **hdre**. It is a binary representation of an **HDR** light-probe file along its prefiltered levels of roughness. The HDR engine of the renderer itself is responsible of parsing and generating HDRE files for later public consumption. To display images in the screen range we work with different web-implemented tone-mapping algorithms.

![alt text](https://webglstudio.org/users/arodriguez/screenshots/damaged_helmet.png)

It also includes a set of tools on the web to extract the environmental light from LDR images of different expossures, and to generate an HDR light probe information object, so it can be used to render a scene with the setting and light complexity of a realistic environment using PBR rendering techniques. It only takes a couple of minutes to render a 3D model with the lighting information of a real environment stored in LDR images.

![alt text](https://webglstudio.org/users/arodriguez/screenshots/hdri_example.png)

We have also created a HDRE repository that will store all the created and assembled (from LDRs) 3D envorironments. It will be available for everyone for browsing, downloading and testing any file on the application. In case of uploading files, a completely free registration will be necessary.

The application makes use of different 3D render web-libraries as [*rendeer.js*](https://github.com/jagenjo/rendeer.js), [*litescene.js*](https://github.com/jagenjo/litescene.js) or [*litegl.js*](https://github.com/jagenjo/litegl.js). All of them created in the UPF-GTI by Javi Agenjo (@jagenjo) for the project *WebGlStudio*. In that context, this application has been complemented with many 3D tools to create and manipulate 3D scenes. Additionally, UPF-GTI has developed for this project a section for generating simple virtual studios using **Chroma Keying** algorithms, completely on the web.

The application can be tested [here](https://webglstudio.org/projects/hdr4eu/), where you will find an index with:

```
    - The stable version of the HDR4EU application
    - The latest version, with new features (and probably more bugs!)
    - The HDRE repository (HDR environmental images for image-based lighting using PBR) 
    - A link to this GitHub repo
```

## Installation

There's no installation needed!

## Usage

- Create HDRE file:

Drag and OpenEXR `exr` or Radiance `hdr` file to the canvas and select the cubemap's face size. When the generation completes, you will find the section `Actions` - `Export` - `Environment` in the menu bar.

- Add 3D objects to the scene:

Execute right mouse click at the canvas and you will have the option to add application default models to the scene or add only mesh primitives (*spheres*, *cubes* and *planes*). It is also possible to drag 3D models with its PBR textures to the application to render them. The meshes could come as:

```
    - Wavefront (.obj)
    - Collada (.dae)
```

- Chroma Keying:

The *Chroma* has been developed in this application as a 3D scene node component. It can be added to any of them by selecting `Add node component` - `ChromaKey` in the node inspector. The chroma lighting has been generated using both point lights and environment lighting. Our algorithm can generate some fake orientation information (normalmap) based on the color information of the image, which can help improve the quality of the image and integrate it better with the surroundings. 

This component could be used also with a webcam as the texture color for the chroma.

- Assemble HDR images from LDR to create HDR environments in HDRE format:

Drag each of the LDR images (up to 9 images) at the canvas in the `Assembly` navigation tab. When ready, click `Assemble` button and you will be able to crop the image and tune some tone-mapping parameters. Last step is to `Export` and test in the application.

![alt text](https://webglstudio.org/users/arodriguez/screenshots/matrix-despacho.png)

## Examples of rendered scenes

![alt text](https://webglstudio.org/users/arodriguez/screenshots/woman_pbr.png)
![alt text](https://webglstudio.org/users/arodriguez/screenshots/chroma_key.png)
![alt text](https://webglstudio.org/users/arodriguez/screenshots/point_lights.png)

