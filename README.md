# HDR4EU


Proof-of-concept web based tools integrated within WebGLStudio which essentially consists of a renderer on the web which can achieve photorealistic results and match real lighting conditions. Presenting a set of web tools to extract the environmental light from HDR images as light probes, to store this information and use it to match the rendered scene with the setting and light complexity of a realistic environment using PBR rendering techniques.

The application can be tested [here](https://webglstudio.org/users/arodriguez/projects/HDR4EU/). To initialize it with an specific number of samples (Prefiltering and blurring processes) it is possible to pass an argument as (e.g.):

```
https://webglstudio.org/users/arodriguez/projects/HDR4EU/?samples=4096
```

An extreme number of samples could reduce the performance. 

## HDRTool.js

Javascript library responsible of parsing and processing different file formats as **raw** and **exr**. The result is used to create a texture [(litegl.js)](https://github.com/jagenjo/litegl.js).

Steps:

*Load* example,


``` 
var filename = "uffizi_gallery.exr";
HDRTool.load( filename ); 
```

As a result, the created texture is stored in ```gl.textures```.

... and *Prefilter*:


``` 
var filename = "uffizi_gallery.exr";
var shader = "blur"; // Shader used for prefiltering (Blur process)
var f = function (...) {  };
HDRTool.prefilter( filename, {to_cubemap: true, oncomplete: f, shader: shader} );
```

When completed, all prefiltered versions of the original texture are stored in ```gl.textures```.

## Results

![alt text](https://webglstudio.org/users/arodriguez/screenshots/example.PNG)
![alt text](https://webglstudio.org/users/arodriguez/screenshots/BlueLights.PNG)

