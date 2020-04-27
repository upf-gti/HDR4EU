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
    
    this.position = [0, 2, 0];
    this.color = [1, 1, 1];
    this.target = vec3.create();
    this.angle = vec2.fromValues(45, 60);
    this.spot_cone = true;
    this.att_start = 0;
    this.att_end = 3;
    this.frustum_size = 3;
    this.intensity = 1;
    this.type = LS.Light.OMNI;
    this.collapsed = false;
    this.mark = true;

    // root has one light
    CORE.hasLight = true;
}

Light.icon = "https://webglstudio.org/latest/imgs/mini-icon-light.png";

Object.defineProperty(Light.prototype, 'position', {
    get: function() { return this._position; },
    set: function(v) { 
        this._position = v; 
        if(CORE)
            CORE.setUniform('light_position', v);
    }, enumerable: true    
});

Object.defineProperty(Light.prototype, 'color', {
    get: function() { return this._color; },
    set: function(v) { 
        this._color = v; 
        if(CORE)
            CORE.setUniform('light_color', v);
    }, enumerable: true    
});

Object.defineProperty(Light.prototype, 'intensity', {
    get: function() { return this._intensity; },
    set: function(v) { 
        this._intensity = v;
        if(CORE)
            CORE.setUniform('light_intensity', v);
    }, enumerable: true
});

Object.defineProperty(Light.prototype, 'target', {
    get: function() { return this._target; },
    set: function(v) { 
        this._target = v;
        if(CORE)
            CORE.setUniform('light_direction', vec3.subtract( vec3.create(), this.position, this.target  ) );
    }, enumerable: true
});

Object.defineProperty(Light.prototype, 'angle', {
    get: function() { return this._angle; },
    set: function(v) { 
        this._angle = v;
        if(CORE)
            CORE.setUniform('light_angle', vec2.scale( vec2.create(), v, DEG2RAD ) );
    }, enumerable: true
});

Object.assign( Light.prototype, {
    
    setup() {
		
        console.log(RM);
        
        if(!LS.Draw.camera)
            LS.Draw.camera = new LS.Camera();

        CORE.setUniform('light_intensity', this.intensity);
        CORE.setUniform('light_color', this.color);
        CORE.setUniform('light_position', this.position);
    },

    remove() {

        CORE.hasLight = false;
        this.intensity = 0;
        this.color = RD.WHITE;
    },
    
	create(widgets) {

        var that = this;

        widgets.widgets_per_row = 1;
		var element = widgets.addSection("Light", {collapsed: that.collapsed, callback: function(no_collapsed){
				that.collapsed = !no_collapsed;
			}});
			
		element.addEventListener("dragstart", function(e){
				e.dataTransfer.setData("type", "gui");
				e.dataTransfer.setData("component", "Light");
		});

		element.setAttribute("draggable", true);

        widgets.addVector3("Position", this.position, {callback: function(v){
            that.position = v;
        }});
        widgets.addColor("Color", this.color, {callback: function(v){ 
            that.color = v;
        }});
        widgets.addSlider("Intensity", this.intensity, {min:0,max:50,step:0.1,callback: function(v) {  
            that.intensity = v; 
        }});
        widgets.addSeparator();
        var values = ["OMNI", "SPOT", "DIRECTIONAL"];
        widgets.addCombo( "Type", values[this.type - 1], {values: values, callback: function(v){

            var new_type = values.indexOf(v) + 1;
            that.type = new_type;

            Object.assign(RM.shader_macros, { LIGHT_TYPE: new_type });
            CORE.renderer.loadShaders("data/shaders.glsl", null, RM.shader_macros);
        }});
        widgets.addVector3("Target", this.target, {callback: function(v){
            that.target = v;
        }});
        widgets.addString("Target node", this.following_node ? this.following_node.name : "", {callback: function(v){
            
            var node = CORE.getByName( v );
            if( node ){
                that.following_node = node;
                that.target = node.getGlobalPosition();
            }else
            {
                that.following_node = null;
            }
            
        }});
        widgets.addVector2("Angle", this.angle, {callback: function(v){
            that.angle = v;
        }});
        
        widgets.addVector2("Attenuation", vec2.fromValues( this.att_start, this.att_end ), {callback: function(v){
            that.att_start = v[0];
            that.att_end = v[1];
        }});

        widgets.addSeparator();
    },

    renderEditor: function()
    {
        var pos = this.position;
        
        if(this.following_node)
            this.target = this.following_node.getGlobalPosition();
        
        var target = this.target;
        gl.depthMask( false );

        var selected = (gui.tab_selected === "Light");

        // LS.DRAW SET CAMERA
        CORE.controller.setLSCamera( window.camera );

        if(CORE.gui._showGizmos)
        {
            gl.enable(gl.BLEND);
            LS.Draw.setColor([1,1,1]);
            LS.Draw.setAlpha(selected ? 0.9 : 0.6);
            LS.Draw.renderImage(pos, "https://webglstudio.org/latest/imgs/gizmo-light.png", 50, true);
            gl.disable(gl.BLEND);
        }

        if(selected && this.type != LS.Light.OMNI)
        {
            LS.Draw.setPointSize( 8 );
            gl.disable(gl.DEPTH_TEST);
            LS.Draw.renderPoints( target ) ;
            gl.enable(gl.DEPTH_TEST);
        }

        if(this.type == LS.Light.OMNI)
        {
            if(CORE.gui._showGizmos)
            {
                //ground line
                gl.enable(gl.BLEND);
                LS.Draw.setColor([0,1,0, selected ? 0.9 : 0.7]);
                LS.Draw.renderLines([ pos ,[ pos[0], 0, pos[2] ]]);
                gl.disable(gl.BLEND);
            }

            if(this.range_attenuation)
            {
                LS.Draw.setColor(this.color);
                LS.Draw.setAlpha(this.intensity);
                gl.enable(gl.BLEND);
                LS.Draw.push();
                LS.Draw.translate( pos );
                LS.Draw.renderWireSphere(this.att_end);
                LS.Draw.pop();
                
                if(this.intensity > 0.1) //dark side
                {
                    gl.depthFunc(gl.GREATER);
                    LS.Draw.setAlpha(0.1);
                    LS.Draw.push();
                    LS.Draw.translate( pos );
                    LS.Draw.renderWireSphere(this.att_end);
                    LS.Draw.pop();
                    gl.depthFunc(gl.LESS);
                }

                gl.disable(gl.BLEND);
            }
        }
        else if (this.type == LS.Light.SPOT)
        {
            var temp = vec3.create();
            var delta = vec3.create();
            vec3.subtract(delta, target,pos );
            vec3.normalize(delta, delta);
            LS.Draw.setColor(this.color);
            LS.Draw.setAlpha(selected ? 1 : 0.8);
            gl.enable(gl.BLEND);
            var f = Math.tan( this.angle[1] * DEG2RAD * 0.5 );
            var near_dist = this.att_start;
            var far_dist = this.att_end;

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
                if(this.spot_cone)
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

                if(this.intensity > 0.1) //dark side
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
                    if(this.spot_cone)
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
        else if (this.type == LS.Light.DIRECTIONAL)
        {
            var temp = vec3.create();
            var delta = vec3.create();
            vec3.subtract(delta, target,pos);
            vec3.normalize(delta, delta);
            LS.Draw.setColor(this.color);
            LS.Draw.setAlpha(selected ? 1 : 0.8);
            gl.enable( gl.BLEND );

            LS.Draw.push();
            LS.Draw.lookAt(pos,target,Math.abs(delta[1]) > 0.99 ? [1,0,0] : [0,1,0]); //work in light space, thats easier to draw
            LS.Draw.renderRectangle( this.frustum_size, this.frustum_size);
            LS.Draw.renderLines([[0,0,0],[0,0,-this.att_end]]);
            LS.Draw.pop();

            gl.disable( gl.BLEND );
        }

    
        gl.depthMask( true );
    }

} );

RM.registerClass( Light, 'Light');