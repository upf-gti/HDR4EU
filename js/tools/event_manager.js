/*
*   Alex Rodriguez
*   @jxarco 
*/

/**
* Responsible for app events
* @class 
*/

class EventManager {

    constructor(webGLcontext, controller) {
    
        this.context = webGLcontext;
        this.controller = controller;
        this.mouse_speed = 0.25;
        this.wheel_speed = 0.5;
        this.keys = {};

        this.node_tools = {

            'rot': false,
            'sca': false,
        };

        this.bind();
    }
    
    bind() {
        
        var ctx = this.context;
        if(!ctx)
            throw('no WebGLRenderingContext');

        var camera = this.camera;
        var s = this.mouse_speed;
        var keys = this.keys;

        ctx.captureKeys(true);
        this.bindKeyboard(ctx);

        ctx.captureMouse(true);
        this.bindMouse(ctx);
    }

    onDrop(e) {
        
        e.preventDefault();
        e.stopPropagation();

        var type = e.dataTransfer.getData("type");

        switch (type) {
            case 'text':
                gui.textToCanvas( e );
                return;
        
            case 'gui':
                gui.sectionToCanvas( e );
                return;
        }

        if(!gui._allow_drop || !e.dataTransfer.files.length)
            return;

        var files = ImporterModule.getFilesFromEvent(e);

        for(var i = 0; i < e.dataTransfer.files.length; i++)
        {
            var file = files[i],
            name = file.name,
            tokens = name.split("."),
            extension = tokens[tokens.length-1].toLowerCase(),
            valid_extensions = [ 'exr', 'hdre', 'png', 'jpg', 'obj', 'wbin', 'json', 'hdrec', "cr2", "jpeg", "hdr" ];
            
            if(valid_extensions.lastIndexOf(extension) < 0)
            {
                LiteGUI.showMessage("Invalid file extension", {title: "Error"});
                return;
            }
            
            if(gui.editor == HDRI_TAB)
                HDRI.onDrag(e, file, extension, name);
            else
                gui.onDragFile( file, extension, name );
        }
    }

    bindKeyboard(ctx) {

        var that = this;

        ctx.onkeydown = function(e)
        {
            that.keys[e.keyCode] = true;

            if(e.keyCode === 116) // F5
            {
                e.preventDefault();
                e.stopPropagation();

                window.localStorage.removeItem("_hdr4eu_recovery");

                // refresh page
                window.location = window.location;
            }

            else if(e.keyCode === 117) // F6
            {
                e.preventDefault();
                e.stopPropagation();

                var data = CORE.toJSON();
                window.localStorage.setItem("_hdr4eu_recovery", JSON.stringify(data));

                // refresh page
                window.location = window.location;
            }

            else if(e.keyCode === 118) // F7
            {
                e.preventDefault();
                e.stopPropagation();
                CORE.reloadShaders(); 
            }
                
            else if(e.keyCode === 82) // R
            {
                // trick to see if something is selected
                if(!window.node)
                return;

                that.node_tools['rot'] = !that.node_tools['rot'];

                if(that.node_tools['rot'])
                    CORE.getByName("lines").color = [0.5, 1, 1, 1];
                else
                    CORE.getByName("lines").color = RD.WHITE;
            }

            else if(e.keyCode === 88) // X
            {
                e.pageX = gl.mouse.mousex;
                e.pageY = gl.mouse.mousey;

                var cmenu = new LiteGUI.ContextMenu( [
                    {
                        title: window.node ? "1 object selected" : (window.nodes ? window.nodes.length + " objects selected" : "No selection"),
                        disabled: true
                    },
                    null,
                    {
                        title: "Delete", 
                        callback: function(){
                            if(RM.Get('NodePicker'))
                                RM.Get('NodePicker').delete();
                            gui.updateSidePanel(null, "root");

                        }
                    }
                ], { event: e });
            }
            
            if(e.keyCode === 83)    // S
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
            
            if(e.keyCode === 49)        // 1
                $("#maintab").click();
            else if(e.keyCode === 50)   // 2
                $("#assemblytab").click();
            
            if(e.keyCode === 79)        // O
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
                if(RM.Get("NodePicker"))
                    RM.Get("NodePicker").unSelect();
                gui.updateSidePanel(null, "root");
            }
        }
        ctx.onkeyup = function(e)
        {
           delete that.keys[e.keyCode];
        }
    }

    bindMouse(ctx) {

        var controller = this.controller;
        var s = this.mouse_speed;
        var that = this;

        ctx.onmousemove = function(e)
        {
            if(!e.dragging && that.node_tools['rot'])
            {
                var node = window.node;
                var dx = e.deltax * 0.5;

                var value = node.rots[1] + dx;
                node.rots[1] = dx;
                node.rotate(value * DEG2RAD, RD.UP);
                return;
            }

            if (e.leftButton) {

                controller.orbit(e.deltax * _dt * s, -e.deltay * _dt * s);
            }
            
            if (e.which == 2) {
                controller.camera.moveLocal([-e.deltax * s * _dt, e.deltay * s * _dt, 0]);
            }
        }

        ctx.captureTouch(true);

        ctx.onmousewheel = function(e)
        {
            if(!e.wheel)
                return;

            // var w = this._wheel_speed / 10;

            var amount =  (1 + e.delta * -0.05);
            controller.changeDistance(amount);
        }

        ctx.onmousedown = function(e){
        
            if(e.leftButton )
            {
                var result = vec3.create();
                var ray = controller.camera.getRay( e.canvasx, e.canvasy );
                var collide_node = CORE.scene.testRay( ray, result, undefined, 0x1, true );
                
                if(collide_node) 
                {
                    // falta saber si está repetido el uid de entre los multiples
                    if(window.node && window.node._uid === collide_node._uid)
                    return;

                    // select another node?
                    if(that.keys[16])
                    {
                        if(RM.Get('NodePicker'))
                            RM.Get('NodePicker').select(collide_node, true);
                        return;
                    }
                    else
                    {
                        if(RM.Get('NodePicker'))
                            RM.Get('NodePicker').select(collide_node);

                        // no array of nodes
                        window.nodes = undefined;

                        // parent is not the scene root
                        var name = collide_node.name;
                        if(!name)
                            name = collide_node.parentNode.name;
                        gui.updateSidePanel(null, name);
                    }
                }
                /*else
                {
                    RM.Get('NodePicker').unSelect()
                    gui.updateSidePanel(null, "root");
                }*/
            }

            else if(e.rightButton && !ctx.keys["L"])
            {
                if(CORE.browser === "edge")
                    return;

                var contextmenu = new LiteGUI.ContextMenu( getContextMenuActions(), { event: e });
            }
        }

        ctx.onmouseup = function(e){
        
            
        
        }

    }    

    update(dt, core) {

        if(!core)
        throw('no core instanced');

        var ctx = core._renderer.context || this.context;

        // Hdri tab has other events binded
        if(gui.editor == 1)
            return;

        var camera = core.controller.camera;

        if(window.destination_eye)
            vec3.lerp(camera.position, camera.position, window.destination_eye, 0.3);

        /*var w = this._wheel_speed * 25;
        var s = core.selected_radius ? core.selected_radius * w : w;

        if(ctx.keys["UP"] || ctx.keys["W"]){            camera.moveLocal([0,0,-dt * s]);}
        else if(ctx.keys["DOWN"] || ctx.keys["S"]){     camera.moveLocal([0,0,dt * s]);}

        if(ctx.keys["RIGHT"] || ctx.keys["D"]){         camera.moveLocal([dt * s,0,0]);}
        else if(ctx.keys["LEFT"] || ctx.keys["A"]){     camera.moveLocal([dt * -s,0,0]);}

        if(ctx.keys["SPACE"]){                              camera.moveLocal([0,dt * s,0]);}
        else if(ctx.keys["SHIFT"]){                         camera.moveLocal([0,dt * -s,0]);}*/
    }
}


function getContextMenuActions()
{
	var shaded_models = [];
	var scenes = RM.scenes;
	// var RenderComponent = RM.Get("Render");

	if(!CORE)
		throw("no core instanced");

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
                    title: "Irradiance Cache",
                    callback: function() { RM.registerComponent( IrradianceCache, 'IrradianceCache'); gui.updateSidePanel(null, "root", {maxScroll: true}); }
                }]
            }
        },
/*        {
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

	return actions;
}

