# H2020 HDR4EU Project

Proof-of-concept web based tools integrated within WebGLStudio which essentially consists of a renderer on the web which can achieve photorealistic results and match real lighting conditions. Presenting a set of web tools to extract the environmental light from HDR images as light probes, to store this information and use it to match the rendered scene with the setting and light complexity of a realistic environment using PBR rendering techniques.

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

## Results

![alt text](https://webglstudio.org/users/arodriguez/screenshots/example.PNG)
![alt text](https://webglstudio.org/users/arodriguez/screenshots/BlueLights.PNG)

