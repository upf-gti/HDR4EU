# H2020 HDR4EU Project

The HDR4EU is a EU project related to HDR data. 
This repository contains a set of web-tools, libraries and fileformat descriptions developed by the GTI group from Universitat Pompeu Fabra to tackle de problem of using HDR images on the web.

In this repository you will find a web-tool renderer which can achieve photorealistic results and match real lighting conditions thanks to the use of image-based HDR lighting.

It also includes a set of tools on the web to extract the environmental light from LDR images of different expossures, and to generate an HDR light probe information object, so it can be used to render a scene with the setting and light complexity of a realistic environment using PBR rendering techniques.

Physically based rendering is a rendering method that provides a more accurate representation of materials and how they interact with light when compared to traditional real-time models. The separation of materials and lighting at the core of the PBR method makes it easier to create realistic assets that look accurate in all lighting conditions. From [Filament](https://google.github.io/filament/Filament.md.html)

The application can be tested [here](https://webglstudio.org/users/arodriguez/projects/HDR4EU/). We have determined the file format used, called **hdre**. It is a binary representation of an **OpenEXR** light-probe file along its prefiltered levels of roughness.  
To use an EXR, drag it into the canvas. An specific number of samples can be set (Prefiltering process) as an argument (e.g.):

```
https://webglstudio.org/users/arodriguez/projects/HDR4EU/?samples=4096
```

An extreme number of samples could reduce the performance and the webgl context could be lost. 

## HDRTool.js

JS library responsible of request, process and use the application data. 

*Load* example,


```javascript
var filename = "uffizi_gallery.exr";
HDRTool.load( filename ); 
```

As a result, the created texture is stored in ```gl.textures```.

... or *Prefilter*:


```javascript
var filename = "uffizi_gallery.exr";
var f = function (...) {  };
HDRTool.prefilter( filename, {oncomplete: f} );
```

When completed, all prefiltered versions of the original texture are stored in ```gl.textures```. If the file is not loaded in memory, the method itself will call ```load```.

## hdre.js

JS library responsible of writing and parsing  **hdre** files. 

## Rendered scenes

![alt text](https://webglstudio.org/users/arodriguez/screenshots/black_spheres.PNG)
![alt text](https://webglstudio.org/users/arodriguez/screenshots/iman.PNG)
![alt text](https://webglstudio.org/users/arodriguez/screenshots/lights.PNG)

