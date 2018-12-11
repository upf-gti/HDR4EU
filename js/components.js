/*
*   Alex Rodríguez
*   @jxarco 
*/

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
	},
	
	PICK: {

		_selected: null,
	}
};

WS.Components.PICK.select = function(node)
{
	if(node.constructor !== RD.SceneNode)
	throw("bad param");

	this._selected = node;
},

WS.Components.PICK.delete = function()
{
	if(!this.selected)
		return;

	if(this.selected.name === 'light') {
		WS.Components.LIGHT.color = [0, 0, 0];
		light = null;
	}

	this.selected.destroy(true);
	this.selected = null;
	delete gl.meshes['lines'];

	for(var t in gl.textures)
		if(t.includes( this._last_environment ))
			delete gl.textures[t];
},

WS.Components.PICK.render = function()
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
		let res = vec3.create(),
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
		let i = this.intensity;
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
		let color = this.color;
		light.color = [color[0]*v, color[1]*v, color[2]*v];
	},
	enumerable: true
});

//
// PICK
// 
Object.defineProperty(WS.Components.PICK, 'selected', {
	get: function() { return this._selected; },
	set: function(v) { this._selected = v;},
	enumerable: true
});