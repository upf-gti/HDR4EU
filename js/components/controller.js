/*
*   Alex Rodriguez
*   @jxarco 
*/

/**
* Responsible for camera movement and event bindings
* @class Controller
* @constructor
*/

function Controller(context, o)
{
    if(this.constructor !== Controller)
        throw("Use new to create Controller");
    this._ctor(context);
    if(o)
        this.configure(o);
}

Controller.prototype._ctor = function( context )
{
    this._fov = 45;
    this._near = 0.35;
    this._far = 10000;
    this._aspect = gl.canvas.width / gl.canvas.height;

    this._eye = [0, 5, 5];
    this._target = [0, 5, 0];
    this._up = [0, 1, 0];
    
    this._camera = new RD.Camera();
    this._camera.perspective( this._fov, this._aspect, this._near, this._far);
    this._camera.lookAt( this._eye, this._target, this._up );

    // events
    this._context = context;
    this._mouse_speed = 0.25;
    this._wheel_speed = 0.5;
	this._keys = {};
	this.setBindings();
}

Controller.prototype.reset = function()
{
    this._fov = 45;
    this._near = 0.35;
    this._far = 10000;
    this._aspect = gl.canvas.width / gl.canvas.height;
    
    this._eye = [0, 5, 5];
    this._target = [0, 5, 0];
    this._up = [0, 1, 0];
    
    this._camera.perspective( this._fov, this._aspect, this._near, this._far);
    this._camera.lookAt( this._eye, this._target, this._up );

    // events
    this._mouse_speed = 0.25;
	this._keys = {};

    gui.updateSidePanel(null, 'root');
}

Controller.prototype.configure = function(o)
{
    o = o || {};

	this._fov = o.fov || this._fov;
	this._aspect = gl.canvas.width / gl.canvas.height;
	this._near = o.near || this._near;
	this._far = o.far || this._far;
	this._eye = o.eye || this._eye;
	this._target = o.target || this._target;
	this._up = o.up || this._up;

    this._camera.perspective( this._fov, this._aspect , this._near, this._far);
    this._camera.lookAt( this._eye, this._target, this._up );
}

/**
 * Performs camera lookAt
 * @method lookAt
 * @param {vec3} eye
 * @param {vec3} center
 * @param {vec3} up
 */
Controller.prototype.lookAt = function(eye, center, up)
{
    this._camera.lookAt( eye, center, up );
}

/**
 * Returns controller's camera position
 * @method getCameraPosition
 */
Controller.prototype.getCameraPosition = function()
{
    return this._camera.position;
}

/**
 * Set key bindings
 * @method setBindings
 * @param {WebGLRenderingContext} ctx
 */
Controller.prototype.setBindings = function()
{
    var ctx = this._context;
    if(!ctx)
        throw('no WebGLRenderingContext');

    var camera = this._camera;
    var s = this._mouse_speed;
	var keys = this._keys;

    ctx.captureKeys(true);
    ctx.onkeydown = function(e)
    {
		keys[e.keyCode] = true;

        if(e.keyCode === 82) // R
            CORE.reloadShaders(); 
        if(e.keyCode === 46 || e.keyCode === 8) // SUPR & DELETE
        {
            RM.get('NodePicker').delete();
            gui.updateSidePanel(null, "root");
        }
        if(e.keyCode === 83)
        {
			if(e.ctrlKey)
			{
				gui.onExport();
				e.preventDefault();
				e.stopPropagation();
			}else{
				e.preventDefault();
				e.stopPropagation();
			}

        }
		if(e.keyCode === 49)
        {
			$("#maintab").click();

        }
		if(e.keyCode === 50)
        {
			$("#assemblytab").click();

        }
		if(e.keyCode === 79)
        {
			if(e.ctrlKey)
			{
				CORE.FS.getFiles("scenes").then(data=>gui.onImportFromServer(data));
				e.preventDefault();
				e.stopPropagation();
			}else{
				e.preventDefault();
				e.stopPropagation();
			}

        }
        if(e.keyCode === 27) // ESC
        {
            RM.get('NodePicker').selected = null;
            delete gl.meshes['lines'];
            gui.updateSidePanel(null, "root");
        }
    }
	ctx.onkeyup = function(e)
    {
		keys[e.keyCode] = false;
    }
    ctx.captureMouse(true);

    ctx.onmousemove = function(e)
    {
        if(!e.dragging) return;

        if (e.leftButton) {

            orbitCamera(camera, e.deltax * _dt * s, -e.deltay * _dt * s);
        }
        
        if (e.rightButton && ctx.keys["L"]) {
            camera.moveLocal([-e.deltax * s * 0.75 * _dt, e.deltay * _dt, 0]);
        }
    }

    ctx.captureTouch(true);

    ctx.onmousewheel = function(e)
    {
        if(!e.wheel)
            return;

        // var w = this._wheel_speed / 10;

        var amount =  (1 + e.delta * -0.05);
        changeCameraDistance(amount, camera);
    }

    ctx.onmousedown = function(e){
    
        var colorpicker = RM.get('ColorPicker');
        var pickerEnabled = colorpicker && colorpicker.enabled;

        if(e.leftButton && pickerEnabled)
        {
            colorpicker.getColor(e);
        }

        if(e.leftButton )
        {
            var result = vec3.create();
            var ray = camera.getRay( e.canvasx, e.canvasy );
            var node = CORE.scene.testRay( ray, result, undefined, 0x1, true );
            
            if(node) 
            {
                RM.get('NodePicker').select(node);
                // parent is not the scene root
                var name = node.name;
                if(!name)
                    name = node.parentNode.name;
                gui.updateSidePanel(null, name);
            }
        }

        if(e.rightButton && !ctx.keys["L"])
        {
			if(CORE.browser === "edge")
				return;

            var shaded_models = [];
            var scenes = RM.scenes;
			var RenderComponent = RM.get("Render");

            // OJO CON ESTE
            for(var s in scenes)
                shaded_models.push( {title: scenes[s].name, callback: function(v) {
                    CORE.parse( v.title );
                    gui.updateSidePanel(null, v.title );
                }});

            var actions = [
            {
                title: "Model", //text to show
                has_submenu: true,
                submenu: {
                    options: shaded_models
                }
            },
            {
                title: "Primitive", //text to show
                has_submenu: true,
                submenu: {
                    options: 
                    [{
                        title: "Sphere",
                        callback: function() { CORE.addPrimitive("sphere") }
                    },{
                        title: "Plane",
                        callback: function() { CORE.addPrimitive("plane") }
                    },{
                        title: "Cube",
                        callback: function() { CORE.addPrimitive("cube") }
                    }]
                }
                
            },
			{
                title: "Component", //text to show
                has_submenu: true,
                submenu: {
                    options: 
                    [{
                        title: "Histogram",
                        callback: function() { RM.registerComponent( Histogram, 'Histogram'); gui.updateSidePanel(null, "root", {maxScroll: true}); }
                    }]
                }
            },
            {
                title: "Light", //text to show
                callback: function() { CORE.addLight() }
            },
			/*,
			{
                title: "Render mode", //text to show
                has_submenu: true,
                submenu: {
                    options: 
                    [{
                        title: "FORWARD",
                        callback: function() { if(RenderComponent) RenderComponent.render_mode = RM.FORWARD; gui.updateSidePanel(null, 'root');}
                    },{
                        title: "DEFERRED",
                        callback: function() { if(RenderComponent) RenderComponent.render_mode = RM.DEFERRED; gui.updateSidePanel(null, 'root');}
                    }]
                }
            }*/
            ];
            var contextmenu = new LiteGUI.ContextMenu( actions, { event: e });
        }
    }
}

/**
 * Update key bindings
 * @method update
 * @param {number} dt
 * @param {WebGLRenderingContext} ctx
 */
Controller.prototype.update = function(dt, ctx)
{
    if(!ctx)
        throw('no WebGLRenderingContext');

    var camera = this._camera;
    if(window.destination_eye)
        vec3.lerp(camera.position, camera.position, window.destination_eye, 0.3);

    var w = this._wheel_speed * 25;
    var s = CORE.selected_radius ? CORE.selected_radius * w : w;

    if(ctx.keys["UP"] || ctx.keys["W"]){            this._camera.moveLocal([0,0,-dt * s]);}
    else if(ctx.keys["DOWN"] || ctx.keys["S"]){     this._camera.moveLocal([0,0,dt * s]);}

    if(ctx.keys["RIGHT"] || ctx.keys["D"]){         this._camera.moveLocal([dt * s,0,0]);}
    else if(ctx.keys["LEFT"] || ctx.keys["A"]){     this._camera.moveLocal([dt * -s,0,0]);}

    if(ctx.keys["SPACE"]){                              this._camera.moveLocal([0,dt * s,0]);}
    else if(ctx.keys["SHIFT"]){                         this._camera.moveLocal([0,dt * -s,0]);}
}