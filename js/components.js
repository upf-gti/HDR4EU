
/*
	List of components to use in the app
	global components or gui components
*/

function Tonemapper()
{
    if(this.constructor !== Tonemapper)
        throw("Use new");

    this.uniforms = {};
}

Tonemapper.prototype.apply = function(input, output)
{
	var shader = this.shader;

	if(!shader)
	throw('Shader missing');	

	if(!input)
	throw('Input texture missing');	

    // Join renderer uniforms with own uniforms
	var uniforms = Object.assign(renderer._uniforms, this.uniforms);

	output.drawTo(function(){
		input.bind(0);
		shader.toViewport( uniforms );
	});
}

Tonemapper.prototype.injectCode = function( base_class )
{
    var fs_code = `

        precision highp float;
        varying vec2 v_coord;
        uniform float u_exposure;
        uniform float u_offset;
        uniform sampler2D u_color_texture;

        ` + base_class.Uniforms + `

        float C_GAMMA = 2.2;

        void main() {

            vec3 color = texture2D(u_color_texture, v_coord).rgb;

            color *= pow( 2.0, u_exposure );
            color += vec3(u_offset);

            ` + base_class.Code + `

            #ifdef GAMMA
                C_GAMMA = GAMMA;
            #endif

            color = pow(color, vec3(1.0/C_GAMMA));

            gl_FragColor = vec4(color, 1.0);
        }

    `;

    return fs_code;
}

Tonemapper.prototype.setParam = function ( name, value )
{
	
	this.params[name].value = value;

}

// *****************************************************************************
//				bon nadal
// *****************************************************************************


/*function Light()
{
    if(this.constructor !== Light)
        throw("Use new");
	

	this.position = vec3.fromValues(1, 5, 1);
	this.color = [1, 1, 1];
	this.intensity = 0;
}

CORE.registerComponent( Light, 'Light');*/



function NodePicker()
{
    if(this.constructor !== NodePicker)
        throw("Use new");
	
	this.selected = null;
}

NodePicker.prototype.setup = function()
{
	
}

NodePicker.prototype.select = function(node)
{
	if(node.constructor !== RD.SceneNode)
	throw("bad param");

	this.selected = node;
}

NodePicker.prototype.delete = function()
{
	if(!this.selected)
		return;

	if(this.selected.name === 'light') {
		WS.Components.LIGHT.color = [0, 0, 0];
		light = null;
	}

	this.selected.destroy();
	this.selected = null;
	delete gl.meshes['lines'];

	for(var t in gl.textures)
		if(t.includes( this._last_environment ))
			delete gl.textures[t];

	setTimeout( function(){
	
		gui.updateSidePanel(null, "root");
	}, 10 );
}

NodePicker.prototype.render = function()
{
	var node = this.selected;
	var root = CORE._root;

	if(!node)
	return;

	var bb = gl.meshes[node.mesh].bounding,
		globalMat = node.getGlobalMatrix();
		
	// Get points
	var corners = getBBCorners(bb);

	// Transform points
	for(var i = 0; i < corners.length; i++)
	{
		var res = vec3.create(),
			p = corners[i];

		vec3.transformMat4( res, p, globalMat );
		corners[i] = res;
	}

	// Create list for mesh
	var points = [];
	points.push(

			corners[0], corners[1],
			corners[1], corners[3],
			corners[3], corners[2],
			corners[2], corners[0],

			corners[4], corners[5],
			corners[5], corners[7],
			corners[7], corners[6],
			corners[6], corners[4],

			corners[0], corners[4],
			corners[1], corners[5],
			corners[2], corners[6],
			corners[3], corners[7]
	);

	var vertices = [];

	for(var i = 0; i < points.length; ++i)
			vertices.push(points[i][0], points[i][1], points[i][2]);

	if(!gl.meshes["lines"])
	{
		var mesh = GL.Mesh.load({ vertices: vertices });
		gl.meshes["lines"] = mesh;
		var l = new RD.SceneNode();
		l.flags.ignore_collisions = true;
		l.primitive = gl.LINES;
		l.mesh = "lines";
		l.name = "lines";
		l.color = [1,1,1,1];
		root.addChild(l);
	}
	else
	{
		var mesh = gl.meshes["lines"];
		mesh.getBuffer("vertices").data.set( vertices );
		mesh.getBuffer("vertices").upload( GL.STREAM_DRAW );
	}
}

CORE.registerComponent( NodePicker, 'NodePicker');


function ColorPicker()
{
    if(this.constructor !== ColorPicker)
        throw("Use new");

	this.button = null;
	this.enabled = false;
}

ColorPicker.prototype.setup = function()
{
	var button = document.querySelector(".tool-colorpicker");
	if(!button)
		console.error('something missing :(');

	this.button = $(button);

	var that = this;

	this.button.on('click', function(){
	
		$(this).addClass("enabled");
		CORE.getCanvas().style.cursor = 'crosshair';
		that.enabled = true;
	});
}

// @param e: mouse event
ColorPicker.prototype.getColor = function( e )
{
	var mouse = [e.canvasx, gl.canvas.height - e.canvasy];
	var x = parseInt(mouse[0]), y = parseInt(mouse[1]);

	if(x == null || y == null) throw('No mouse'); 

    var WIDTH = CORE._viewport_tex.width;
    var HEIGHT = CORE._viewport_tex.height;

	y = HEIGHT - y;

    var pixel = 4 * (y * WIDTH + x);

	var pixelColor = [
        CORE._viewport_tex.getPixels()[pixel],
        CORE._viewport_tex.getPixels()[pixel+1],
        CORE._viewport_tex.getPixels()[pixel+2],
        CORE._viewport_tex.getPixels()[pixel+3],
    ];

	document.querySelector("#pixelPickerText").innerHTML = 'R: '+pixelColor[0].toFixed(4)+' G: '+pixelColor[1].toFixed(4)+' B: '+pixelColor[2].toFixed(4);

	this.enabled = false;
	this.button.removeClass("enabled");
	CORE.getCanvas().style.cursor = 'default';
}

CORE.registerComponent( ColorPicker, 'ColorPicker');

/*
	GUI components
*/


/*function SFX()
{
    if(this.constructor !== SFX)
        throw("Use new");
	
	this.exposure = 0;
	this.offset= 0;

	this.glow_enable = false;
	this.glow_intensity = 1;
	this.glow_threshold = 25;
	this.glow_iterations = 8;

	this.fxaa = true;

	this.tonemapping = "Reinhard";
    
}

CORE.registerComponent( SFX, 'Screen FX');*/

WS.Components = {

	FX: {
		_exposure: 0,
		_offset: 0,

		_glow_enable: false,
		_glow_intensity: 1,
		_glow_threshold: 25,
		_glow_iterations: 8,

		_fxaa: true,

		_tonemapping: "Reinhard",
	},

	LIGHT: {
		_position: vec3.fromValues(1, 5, 1),
		_color: [1, 1, 1],
		_intensity: 0
	}
};

//
// FX
// 
Object.defineProperty(WS.Components.FX, 'exposure', {
	get: function() { return this._exposure; },
	set: function(v) { this._exposure = v; renderer._uniforms["u_exposure"] = v; },
	enumerable: true
});

Object.defineProperty(WS.Components.FX, 'offset', {
	get: function() { return this._offset; },
	set: function(v) { this._offset = v; renderer._uniforms["u_offset"] = v; },
	enumerable: true
});

Object.defineProperty(WS.Components.FX, 'glow_enable', {
	get: function() { return this._glow_enable; },
	set: function(v) { this._glow_enable = v; },
	enumerable: true
});

Object.defineProperty(WS.Components.FX, 'glow_intensity', {
	get: function() { return this._glow_intensity; },
	set: function(v) { this._glow_intensity = v; window.intensity = v; },
	enumerable: true
});

Object.defineProperty(WS.Components.FX, 'glow_threshold', {
	get: function() { return this._glow_threshold; },
	set: function(v) { this._glow_threshold = v; window.threshold = v; },
	enumerable: true
});

Object.defineProperty(WS.Components.FX, 'glow_iterations', {
	get: function() { return this._glow_iterations; },
	set: function(v) { this._glow_iterations = v; window.iterations = v; },
	enumerable: true
});

Object.defineProperty(WS.Components.FX, 'tonemapping', {
	get: function() { return this._tonemapping; },
	set: function(v) { this._tonemapping = v; },
	enumerable: true
});

Object.defineProperty(WS.Components.LIGHT, 'color', {
	get: function() { return this._color; },
	set: function(v) { 
		this._color = v; 
		renderer._uniforms['u_light_color'] = v;
		if(!light)
			return;
		var i = this.intensity;
		light.color = [v[0]*i, v[1]*i, v[2]*i];
	},
	enumerable: true
});

Object.defineProperty(WS.Components.LIGHT, 'position', {
	get: function() { return this._position; },
	set: function(v) { this._position = v; renderer._uniforms['u_light_position'] = v; light.position = v;},
	enumerable: true
});

Object.defineProperty(WS.Components.LIGHT, 'intensity', {
	get: function() { return this._intensity; },
	set: function(v) { 
		this._intensity = v;
		renderer._uniforms['u_light_intensity'] = v;
		if(!light)
			return;
		var color = this.color;
		light.color = [color[0]*v, color[1]*v, color[2]*v];
	},
	enumerable: true
});