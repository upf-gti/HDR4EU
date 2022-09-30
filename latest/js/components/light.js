/*
*   Alex Rodriguez
*   @jxarco 
*/

function Light()
{
    if(this.constructor !== Light)
        throw("Use new");

    if(CORE.hasLight) {
        LiteGUI.alert("Error (Only one light supported)");
        return;
    }

    var root = new LS.Light();
    root.position = [0, 2, 0];
    root.color = [1, 1, 1];
    root.target = vec3.create();
    root.angle = 45;
    root.angle_end = 60;
    root.spot_cone = true;
    root.attenuation_type = LS.Light.RANGE_ATTENUATION;
    root.att_start = 0;
    root.att_end = 3;
    root.frustum_size = 5;
    root.intensity = 1;
    root.type = LS.Light.OMNI;

    this.root = root;
    this.mark = true;
    this.collapsed = false;
    this.shadowmap_res = 1024;

    // root has one light
    CORE.GlobalLight = this;

    var node = new RD.SceneNode();
    node.name = "@light_SceneNode";
    node.scaling = 0.0001;
    node._nogui = true;
    node.mesh = "sphere";
    node.shader = "textured";
    node.color = [1, 0, 0, 1];
    node.flags.depth_write = false;
    node.flags.depth_test = false;
    node.blend_mode = RD.BLEND_ALPHA;
    node.position = root.position;
    CORE.LightNode = node;

    node.onApplyTransform = function() {
        root.position = this.position;
    }

}

Light.icon = "https://webglstudio.org/latest/imgs/mini-icon-light.png";

Object.assign( Light.prototype, {
    
    setup() {
		
        // console.log(RM);
        
        if(!LS.Draw.camera)
            LS.Draw.camera = new LS.Camera();
    },

    remove() {

        CORE.GlobalLight = null;
    },

    getUniforms()
    {
        var uniforms = {};

        uniforms["u_light_position"] = this.root.position;
        uniforms["u_light_color"] = this.root.color;
        uniforms["u_light_intensity"] = this.root.intensity;
        uniforms["u_light_direction"] = vec3.subtract( vec3.create(), this.root.position, this.root.target  );
        uniforms["u_light_angle"] = vec2.scale( vec2.create(), vec2.fromValues(this.root.angle, this.root.angle_end), DEG2RAD );
        uniforms["u_att_type"] = this.root.attenuation_type;
        uniforms["u_att_info"] = vec2.fromValues(this.root.att_start, this.root.att_end);

        uniforms["u_receive_shadows"] = this.root.cast_shadows;

        if(this.root.cast_shadows)
        {
            uniforms["u_shadow_params"] = this.shadowmap.shadow_params;
            uniforms["u_light_matrix"] = this.root.shadow_camera._viewprojection_matrix;
        }

        return uniforms;
    },

    getShadowmapTexture: function()
    {
        if(!this.shadowmap)
        return;

        return this.shadowmap.texture;
    },
    
	create(widgets) {

        var that = this;
        var root = this.root;

        widgets.widgets_per_row = 1;
		var element = widgets.addSection("Light", {collapsed: that.collapsed, callback: function(no_collapsed){
				that.collapsed = !no_collapsed;
			}});
			
		element.addEventListener("dragstart", function(e){
				e.dataTransfer.setData("type", "gui");
				e.dataTransfer.setData("component", "Light");
		});

		element.setAttribute("draggable", true);

        var values = ["OMNI", "SPOT", "DIRECTIONAL"];
        widgets.addCombo( "Type", values[root.type - 1], {values: values, callback: function(v){

            var new_type = values.indexOf(v) + 1;
            root.type = new_type;

            Object.assign(RM.shader_macros, { LIGHT_TYPE: new_type });
            CORE.renderer.loadShaders("data/shaders.glsl", null, RM.shader_macros);

            // change bias (linear/not linear)

            if(!that.shadowmap)
            return;

            if(new_type === LS.Light.DIRECTIONAL)
                that.shadowmap.bias = 0.0003;
            else
                that.shadowmap.bias = 0.04;

            gui.updateSidePanel(null, "root", {tab: "Light"});
        }});

        widgets.addColor("Color", root.color, {callback: function(v){ 
            root.color = v;
        }});
        widgets.addSlider("Intensity", root.intensity, {min:0,max:15,step:0.1,callback: function(v) {  
            root.intensity = v; 
        }});

        // Vectors

        widgets.addSeparator();

        widgets.addVector3("Position", root.position, {step: 0.5, callback: function(v){
            root.position = v;
            CORE.LightNode.position = v;

            /*if(CORE.gizmo)
                CORE.gizmo.updateGizmo();*/
        }});
        
        widgets.addVector3("Target", root.target, {callback: function(v){
            root.target = v;
        }});
        widgets.addString("Target node", root.following_node ? root.following_node.name : "", {callback: function(v){
            
            var node = CORE.getByName( v );
            if( node ){
                root.following_node = node;
                root.target = node.getGlobalPosition();
            }else
            {
                root.following_node = null;
                root.target = [0, 0, 0];
            }
            
        }});

        widgets.addSeparator();

        widgets.addNumber("Frustum size", root.frustum_size, {name_width: "40%",callback: function(v){
            root.frustum_size = v;
        }});

        var att_values = ["NONE", "LINEAR", "RANGE"];
        widgets.addCombo( "Attenuation type", att_values[root.attenuation_type], {name_width: "40%", values: att_values, callback: function(v){
            var new_type = att_values.indexOf(v);
            root.attenuation_type = new_type;
        }});

        widgets.addVector2("Attenuation", vec2.fromValues( root.att_start, root.att_end ), {name_width: "40%", callback: function(v){
            root.att_start = v[0];
            root.att_end = v[1];
        }});

        widgets.addVector2("Angle", vec2.fromValues( root.angle, root.angle_end ), {name_width: "40%",callback: function(v){
            root.angle = v[0];
            root.angle_end = v[1];
        }});

        widgets.addSeparator();

        widgets.addCheckbox("Cast shadows", root.cast_shadows, {callback: function(v){ 
            root.cast_shadows = v; 

            // reset shadowmap
            if(!v & that.shadowmap)
            that.shadowmap = null;

            setTimeout(function(){

                gui.updateSidePanel(null, "root", {tab: "Light"});

            }, 100);
            
        }});

        if(root.cast_shadows)
        {
            widgets.addTitle("Shadow options");
            widgets.addCombo("Resolution", that.shadowmap_res, {values: [256, 512, 1024, 2048, 4096], callback: function(v){

                that.shadowmap_res = v;

            }});
            widgets.addVector2("Clip shadows", vec2.fromValues( root.near, root.far ), {step: 0.01, callback: function(v){
                root.near = v[0];
                root.far = v[1];
            }});

            widgets.addNumber("Bias",  this.shadowmap ? this.shadowmap.bias : 0, {step: 0.00001, precision: 8,callback: function(v){
                that.shadowmap.bias = v;
            }});
        }
        
    },

    checkRayCollision: function(x, y)
    {
        var pos = this.root.position;
        var pos2D = camera.project( pos );

        var collided = false;

        collided = Math.abs(x - pos2D[0]) < 25
        && Math.abs(y - pos2D[1]) < 25;

        if(collided)
        { 
           // CORE.gizmo.setTargets( [].concat(CORE.LightNode) );
            gui.updateSidePanel(null, "root", {tab: "Light"});
        }
            

        return collided;
    },

    generateShadowMap: function( options )
    {   
        if(!this.root.cast_shadows)
		return;

        if(!this.shadowmap)
            this.shadowmap = new Shadowmap( this.root );

        this.shadowmap.generate( this.shadowmap_res );
        this.shadowmap.prepare();
    },

    renderEditor: function()
    {
        if(!CORE.gui._showGizmos)
        return;

        var root = this.root;
        var pos = root.position;
        
        if(root.following_node)
            root.target = root.following_node.getGlobalPosition();
        
        var target = root.target;
        gl.depthMask( false );

        var selected = (gui.tab_selected === "Light");

        // LS.DRAW SET CAMERA
        CORE.controller.setLSCamera( window.camera );

        if(selected && root.type != LS.Light.OMNI)
        {
            LS.Draw.setPointSize( 8 );
            gl.disable(gl.DEPTH_TEST);
            LS.Draw.renderPoints( target ) ;
            gl.enable(gl.DEPTH_TEST);
        }

        if(root.type == LS.Light.OMNI)
        {
            //ground line
            gl.enable(gl.BLEND);
            LS.Draw.setColor([0,1,0, selected ? 0.9 : 0.35]);
            LS.Draw.renderLines([ pos ,[ pos[0], 0, pos[2] ]]);
            gl.disable(gl.BLEND);

            if(root.range_attenuation)
            {
                LS.Draw.setColor(root.color);
                LS.Draw.setAlpha(root.intensity);
                gl.enable(gl.BLEND);
                LS.Draw.push();
                LS.Draw.translate( pos );
                LS.Draw.renderWireSphere(root.att_end);
                LS.Draw.pop();
                
                if(root.intensity > 0.1) //dark side
                {
                    gl.depthFunc(gl.GREATER);
                    LS.Draw.setAlpha(0.1);
                    LS.Draw.push();
                    LS.Draw.translate( pos );
                    LS.Draw.renderWireSphere(root.att_end);
                    LS.Draw.pop();
                    gl.depthFunc(gl.LESS);
                }

                gl.disable(gl.BLEND);
            }
        }
        else if (root.type == LS.Light.SPOT)
        {
            var temp = vec3.create();
            var delta = vec3.create();
            vec3.subtract(delta, target,pos );
            vec3.normalize(delta, delta);
            LS.Draw.setColor(root.color);
            LS.Draw.setAlpha(selected ? 0.9 : 0.5);
            gl.enable(gl.BLEND);
            var f = Math.tan( root.angle_end * DEG2RAD * 0.5 );
            var near_dist = root.att_start;
            var far_dist = root.att_end;

            vec3.scale(temp, delta, far_dist);
            vec3.add(temp, pos, temp);

            LS.Draw.push();
            LS.Draw.lookAt(pos,temp,Math.abs(delta[1]) > 0.99 ? [1,0,0] : [0,1,0]); //work in light space, thats easier to draw
            
            LS.Draw.push();
            LS.Draw.renderLines([[0,0,0],[0,0,-far_dist],
                [0,f*near_dist,-near_dist],[0,f*far_dist,-far_dist],
                [0,-f*near_dist,-near_dist],[0,-f*far_dist,-far_dist],
                [f*near_dist,0,-near_dist],[f*far_dist,0,-far_dist],
                [-f*near_dist,0,-near_dist],[-f*far_dist,0,-far_dist]
                ]);
            LS.Draw.translate(0,0,-near_dist);
            if(root.spot_cone)
            {
                LS.Draw.renderCircle( near_dist * f,100 );
                LS.Draw.translate(0,0,near_dist-far_dist);
                LS.Draw.renderCircle( far_dist * f,100 );
            }
            else
            {
                LS.Draw.renderRectangle( near_dist * f*2,near_dist * f*2);
                LS.Draw.translate(0,0,near_dist-far_dist);
                LS.Draw.renderRectangle( far_dist * f*2,far_dist * f*2);
            }
            LS.Draw.pop();

            if(root.intensity > 0.1) //dark side
            {
                gl.depthFunc(gl.GREATER);
                LS.Draw.setAlpha(0.1);
                LS.Draw.renderLines([[0,0,-near_dist],[0,0,-far_dist],
                    [0,f*near_dist,-near_dist],[0,f*far_dist,-far_dist],
                    [0,-f*near_dist,-near_dist],[0,-f*far_dist,-far_dist],
                    [f*near_dist,0,-near_dist],[f*far_dist,0,-far_dist],
                    [-f*near_dist,0,-near_dist],[-f*far_dist,0,-far_dist]
                    ]);
                LS.Draw.translate(0,0,-near_dist);
                if(root.spot_cone)
                {
                    LS.Draw.renderCircle( near_dist * f,100 );
                    LS.Draw.translate(0,0,near_dist-far_dist);
                    LS.Draw.renderCircle( far_dist * f,100 );
                }
                else
                {
                    LS.Draw.renderRectangle( near_dist * f*2,near_dist * f*2);
                    LS.Draw.translate(0,0,near_dist-far_dist);
                    LS.Draw.renderRectangle( far_dist * f*2,far_dist * f*2);
                }
                gl.depthFunc(gl.LESS);
            }
            LS.Draw.pop();
            LS.Draw.setAlpha(1);
            gl.disable(gl.BLEND);
        }
        else if (root.type == LS.Light.DIRECTIONAL)
        {
            var temp = vec3.create();
            var delta = vec3.create();
            vec3.subtract(delta, target,pos);
            vec3.normalize(delta, delta);
            LS.Draw.setColor(root.color);
            LS.Draw.setAlpha(selected ? 0.9 : 0.6);
            gl.enable( gl.BLEND );

            LS.Draw.push();
            LS.Draw.lookAt(pos,target,Math.abs(delta[1]) > 0.99 ? [1,0,0] : [0,1,0]); //work in light space, thats easier to draw
            LS.Draw.renderRectangle( root.frustum_size, root.frustum_size);
            LS.Draw.renderLines([[0,0,0],[0,0,-root.att_end]]);
            LS.Draw.pop();

            gl.disable( gl.BLEND );
        }

        gl.enable(gl.BLEND);
        LS.Draw.setColor([1,1,1]);
        LS.Draw.setAlpha(selected ? 0.9 : 0.6);
        LS.Draw.renderImage(pos, "https://webglstudio.org/latest/imgs/gizmo-light.png", 50, true);
        LS.Draw.setAlpha(1);
        gl.disable(gl.BLEND);

        gl.depthMask( true );
    },
    
    toJSON() {
            
        var json = Object.assign({}, this);
        delete json.shadowmap;

        return json;
    },

    onImport() {
        
        var light_info = Object.assign({}, this.root);

        for( var i in light_info )
        {
            if(i[0] !== "_")
            continue;

            light_info[ i.substring( 1, i.length ) ] = light_info[i];
            delete light_info[i];
        }

        this.root = new LS.Light( light_info );

        // update shader macros
        Object.assign(RM.shader_macros, { LIGHT_TYPE: light_info.type });
        CORE.renderer.loadShaders("data/shaders.glsl", null, RM.shader_macros);
    },

} );

RM.registerClass( Light, 'Light');

// Shadow mapping code

function Shadowmap( light )
{
	this.light = light;

	this.bias = 0.03;
	this.format = GL.DEPTH_COMPONENT;
	this.layers = 0xFF; //visible layers
	this.texture = null;
	this.fbo = null;
	this.shadow_params = vec4.create(); //1.0 / this.texture.width, this.shadow_bias, this.near, closest_far
	this.reverse_faces = false; //improves quality in some cases
}

Shadowmap.use_shadowmap_depth_texture = true;

Shadowmap.prototype.generate = function( resolution )
{
    var light = this.light;
    var render_settings = new LS.RenderSettings();

	var light_intensity = light.computeLightIntensity();
    if( light_intensity < 0.0001 )
    {
        console.warn("Low light intensity to compute shadowmap");
		return;
    }

	//create the texture
	var shadowmap_resolution = resolution || render_settings.default_shadowmap_resolution;

	//shadowmap size
	var shadowmap_width = shadowmap_resolution;
	var shadowmap_height = shadowmap_resolution;
	if( light.type == LS.Light.OMNI)
		shadowmap_height *= 6; //for every face -> store all info in a tex2D

	var tex_type = gl.TEXTURE_2D;
	if(this.texture == null || this.texture.width != shadowmap_width || this.texture.height != shadowmap_height ||  this.texture.texture_type != tex_type )
	{
		var type = gl.UNSIGNED_BYTE;
		var format = gl.RGBA;

		//not all webgl implementations support depth textures
		if( Shadowmap.use_shadowmap_depth_texture && gl.extensions.WEBGL_depth_texture )
		{
			format = gl.DEPTH_COMPONENT;
			type = gl.UNSIGNED_INT;
		}

		//create texture to store the shadowmap
		this.texture = new GL.Texture( shadowmap_width, shadowmap_height, { type: type, texture_type: tex_type, format: format, magFilter: gl.NEAREST, minFilter: gl.NEAREST });

        this.texture.filename = ":shadowmap_";
		gl.textures[ this.texture.filename ] = this.texture; 

		if( this.texture.texture_type == gl.TEXTURE_2D )
		{
			if(format == gl.RGBA)
				this.fbo = new GL.FBO( [this.texture] );
			else
				this.fbo = new GL.FBO( null, this.texture );
		}
	}

	//render the scene inside the texture
	this.fbo.bind();

	var sides = 1;
	var viewport_width = this.texture.width;
	var viewport_height = this.texture.height;
	if( light.type == LS.Light.OMNI )
	{
		sides = 6;
		viewport_height /= 6;
	}

	gl.clearColor(1, 1, 1, 1);
	if( this.texture.type == gl.DEPTH_COMPONENT )
		gl.colorMask(false,false,false,false);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	for(var i = 0; i < sides; ++i) //in case of omni
	{
		let shadow_camera = light.getLightCamera(i);
		this.shadow_params[2] = shadow_camera.near;
		this.shadow_params[3] = shadow_camera.far;

		var viewport_y = 0;
		if( light.type == LS.Light.OMNI )
			viewport_y = i * viewport_height;
		gl.viewport(0,viewport_y,viewport_width,viewport_height);

        var RCamera = CORE.convertCamera( shadow_camera, light.type );

        light.shadow_camera = RCamera;
		renderer.render(CORE.scene, RCamera, CORE.getRenderableNodes());
	}

	this.fbo.unbind();
	gl.colorMask(true,true,true,true);

	if(this.onPostProcessShadowMap)
		this.onPostProcessShadowMap( this.texture );
}

Shadowmap.prototype.prepare = function()
{
	if(!this.texture)
	{
		console.warn("shadowmap without texture?");
		return;
	}

	this.shadow_params[0] = 1.0 / this.texture.width;
	this.shadow_params[1] = this.bias;
	//2 and 3 are set when rendering the shadowmap
}

Shadowmap.prototype.toViewport = function()
{
	if(!this.texture)
		return;
	this.texture.toViewport();
}