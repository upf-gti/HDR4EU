/*
*   author: Alex Rodriguez
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
        this.wheel_speed = 1;
        this.keys = {};

        this.mouse = [0, 0];

        this.bind();
    }
    
    bind() {
        
        var ctx = this.context;
        if(!ctx)
            throw('no WebGLRenderingContext');

        ctx.captureKeys(true);
        this.bindKeyboard(ctx);

        ctx.captureMouse(true);
        this.bindMouse(ctx);
    }

    async onDrop(e) {
        
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
        HDRTool.files_in_load = 0;

        for(let i = 0; i < e.dataTransfer.files.length; i++)
        {
            var file = files[i],
            name = file.name,
            tokens = name.split("."),
            extension = tokens[tokens.length-1].toLowerCase(),
            valid_extensions = [ 
                /*'exr', */'hdre', 'png', 'jpg', 'obj', 
                'wbin', 'json', 'hdrec', "cr2", "jpeg", 
                "hdr", "nef", "dae", "hdr"
            ];
            
            if(valid_extensions.lastIndexOf(extension) < 0)
            {
                LiteGUI.alert("Invalid file extension. Extension was '<b>" + extension + "</b>'", {title: "Error"});
                return;
            }

            // info about current file
            e.currentFile = i;

            if(gui.editor == HDRI_TAB) {
                await HDRI.onDrag(e, file, extension, name);
            }
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
                console.log(data);
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
                
            else if(e.keyCode === 70) // F focus
            {
                // trick to see if something is selected
                if(!window.node)
                return;
                
                CORE.controller.onNodeLoaded(window.node, CORE.controller.camera.position);
                
            }

            else if(e.keyCode === 81) // Q
            {
                CORE.gizmo.mode = 0;//RD.Gizmo.ROTATEALL
            }
            

            else if(e.keyCode === 88) // X
            {
                e.pageX = that.mouse[0];
                e.pageY = that.mouse[1];

                var options = [
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
                ];

                if(window.context_menu)
                    window.context_menu.close();
                window.context_menu = new LiteGUI.ContextMenu( options, { event: e });
            }
            
            if(e.keyCode === 65)    // A
            {
                if(e.ctrlKey)
                {
                    window.nodes = [];
                    for(var i = 2; i < CORE.root.children.length; ++i)
                    if(CORE.root.children[i].name !== "lines")
                    {
                        window.node = null;
                        window.nodes.push(CORE.root.children[i]);
                    }
                    
                    e.preventDefault();
                    e.stopPropagation();
                }else{
                    e.preventDefault();
                    e.stopPropagation();
                }

            }

            else if(e.keyCode === 69) // E rotate
            {
                CORE.gizmo.mode = RD.Gizmo.ROTATEALL;
            }

            else if(e.keyCode === 87) // W translate
            {
                //CORE.gizmo.mode = RD.Gizmo.MOVEALL;
                CORE.gizmo.mode = RD.Gizmo.DRAG | RD.Gizmo.MOVEAXIS;
            }

            if(e.keyCode === 83)    // S  export scene when ctrl
            {
                if(e.ctrlKey)
                {
                    gui.onExport();
                    e.preventDefault();
                    e.stopPropagation();
                }
            }

            if(e.keyCode === 82)    // R  scale
            {
                e.preventDefault();
                e.stopPropagation();
                CORE.gizmo.mode = RD.Gizmo.SCALEALL;

            }
            
            if(e.keyCode === 49)   // 1
            {
                if(e.ctrlKey)
                return;

                $("#maintab").click();
            }      
                
            else if(e.keyCode === 50)   // 2
            {
                if(e.ctrlKey)
                return;
                
                $("#assemblytab").click();
            }
                
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
                e.preventDefault();

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
            that.mouse = [e.offsetX, e.offsetY];

            if(CORE.gizmo && CORE.gizmo.onMouse(e))
            return;

            if (e.leftButton && that.is_mouse_down) {

                var AltKey = that.keys[71];
                controller.orbit(e.deltax * _dt * s, -e.deltay * _dt * s, AltKey);
            }
            
            else if (e.which == 2) {
                var speed = vec3.length( vec3.subtract( vec3.create(), camera.target, camera.position )) * 0.1;
                controller.camera.move([-e.deltax * speed * _dt, e.deltay * speed * _dt, 0]);
            }
        }

        ctx.onmousedown = function(e){
        
            if(CORE.gizmo && CORE.gizmo.onMouse(e))
            return;

            that.is_mouse_down = true;

            if(e.button == GL.RIGHT_MOUSE_BUTTON)
            {
                if(CORE.browser === "edge")
                    return;

                if(window.context_menu)
                    window.context_menu.close();
                window.context_menu = new LiteGUI.ContextMenu( getContextMenuActions(), { event: e });
            }

            that.last_mouse_down = getTime();
        }
       
        ctx.onmousewheel = function(e)
        {
            if(!e.wheel)
                return;

            if(CORE.gizmo && CORE.gizmo.onMouse(e))
            return;

            var amount =  (1 + e.delta * -0.05) * that.wheel_speed;
            controller.changeDistance(amount);
        }

        ctx.onmouseup = function(e){
        
            that.is_mouse_down = false;

            if(getTime() -  that.last_mouse_down < 150)
            {
                if(e.button == GL.LEFT_MOUSE_BUTTON)
                {
                    var result = vec3.create();
                    var ray = controller.camera.getRay( e.canvasx, e.canvasy );
                    var collide_node = CORE.scene.testRay( ray, result, undefined, 0x1, true );
                    
                    var light_selected = false;

                    if(CORE.GlobalLight && CORE.GlobalLight.checkRayCollision( e.canvasx, e.canvasy ))
                    {
                        if(RM.Get('NodePicker'))
                            RM.Get('NodePicker').unSelectAll();

                        light_selected = true;
                        CORE.gizmo.setTargets( [].concat(CORE.LightNode) );
                    }

                    if(collide_node) 
                    {
                        // falta saber si está repetido el uid de entre los multiples
                        if(window.node && window.node._uid === collide_node._uid)
                        return;

                        if(!collide_node.visible)
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
                }
            }

            if(CORE.gizmo.targets && CORE.gizmo.targets.length > 0)
            {
                if(CORE.gizmo)
                CORE.gizmo.onMouse(e);
            }
        }

        ctx.captureTouch(true);

    }    

    update(dt) {

        if(!CORE)
        throw('no core instanced');

        var ctx = CORE.renderer.context || this.context;

        // Hdri tab has other events binded
        if(gui.editor == 1)
            return;

        if(this.keys[16])
            this.wheel_speed = 1.1;
        else
            this.wheel_speed = 1;

        var camera = CORE.controller.camera;

        if(CORE.controller.smooth && window.destination_eye) {
            vec3.lerp(camera.position, camera.position, window.destination_eye, 0.3);
            if(camera.position.nearEq(window.destination_eye))
                window.destination_eye = undefined;
        }

        // update light position
        /*if(RM.components.Light)
            RM.components.Light.root.position.set( CORE.LightNode.position );*/
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
        
    var shadings = ["MATERIAL" , "WIREFRAME", "SOLID", "ROUGHNESS", "METALLIC" , "NORMALS"];

	var actions = [
        {
            title: "Model", //text to show
            has_submenu: true,
            submenu: {
                options: shaded_models.sort( e => e.title)
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
            title: "Shading", //text to show
            has_submenu: true,
            submenu: {
                options: 
                [
                {
                    title: "Current: " + shadings[CORE.RMODE],
                    disabled: true
                },
                null,
                {
                    title: "MATERIAL",
                    callback: function() { 
                        CORE.RMODE = Core.MATERIAL; 
                    }
                },
                {
                    title: "WIREFRAME",
                    callback: function() { 
                        CORE.RMODE = Core.WIREFRAME; 
                    }
                },
                {
                    title: "SOLID",
                    callback: function() { 
                        CORE.RMODE = Core.SOLID;
                    }
                },
                {
                    title: "ROUGHNESS",
                    callback: function() { 
                        CORE.RMODE = Core.ROUGHNESS;
                    }
                },
                {
                    title: "METALLIC",
                    callback: function() { 
                        CORE.RMODE = Core.METALLIC;
                    }
                },
                {
                    title: "NORMALS",
                    callback: function() { 
                        CORE.RMODE = Core.NORMALS;
                    }
                }
                
            ]
            }
        }
	];

	return actions;
}

