/*
*   Alex Rodríguez
*   @jxarco 
*/

var CORE        = null,
    LOAD_STEPS  = 6,
    STEPS       = 0,
    _dt         = 0.0;

var ResourceManager = RM = {
        version: 1.0,
        nocache: false,
        debug_imports: false,

        MODELS_FOLDER: "models/",
        TEXTURES_FOLDER: "textures/hdre/",

        shader_macros: {
            "N_SAMPLES": 4096,
            "GAMMA": 2.2,
        },

        tonemappers: {},
        components: {},
		shaders: {},

        FORWARD:	00,
        DEFERRED:	01,

		MULTI_BRDF: 01,

    init: function()
    {
        console.log("%cLoading...","color: #5AF; font-size: 20px" );
        this.setup();
        this.onInit();
    },

    setup: function()
    {
        $(document.body).append(`
        <div id="canvas-tools">
            <div class="tool-section tool-section-manipulate">
                <div class="tool-button tool-colorpicker" title="Pick color" style="background-image: url(https://webglstudio.org/latest/imgs/mini-icon-colorpicker.png)"></div>
                <div class="tool-button tool-sphereprem" title="Show sphere PREM" style="background-image: url(https://webglstudio.org/latest/imgs/mini-icon-circle.png)"></div>
                <div class="tool-button tool-deferredtex" title="Show deferred textures" style="background-image: url(https://webglstudio.org/latest/imgs/mini-icon-depth.png)"></div>
            </div>
        </div>`);
    },

    onInit: function()
    {
        LiteGUI.request({
            url: "config.json?nocache=" + performance.now(),
            dataType: "json",
            nocache: true,
            success: this.onRequest.bind(this)
        });
    },

    onRequest: function(config)
    {
        if(!config) 
        throw("Configuration file not found");

        this.config = config;

        if(config.scenes)
            this.scenes = config.scenes;

        if(config.nocache)
            this.nocache = config.nocache;

        if(config.imports && config.imports.constructor === Array)
            this.onReadImports(config);
    },

    onReadImports: function( config )
    {
        var that = this;
        var import_list = config.imports;
    
        var userAgent = (navigator && navigator.userAgent || '').toLowerCase();
		if(/android/.test(userAgent) || /mobile/.test(userAgent))
		{
            // import_list = import_list.filter(function(e){ !e.includes("tinyexr.js")});
            var aux = [];
            for(var i = 0; i < import_list.length; i++) {
                if(import_list[i] === "js/lib/tinyexr.js")
                continue;
                aux.push( import_list[i] );
            }

            import_list = aux;
        }

        if(this.nocache) {
            var nocache = "?nocache" + performance.now();
            for(var i in import_list)
            import_list[i] += nocache;
        }

        this.totalImports = import_list.length;
        LiteGUI.requireScript(import_list, onLoad, onError, onProgress);

        function onLoad(loaded_scripts)
        {
            var factor = "100%";
            $("#import-text").html(factor);
            $("#import-bar").css('width', factor);
            console.log("%cLoaded","color: #5AF; font-size: 20px");

            var last_loaded = loaded_scripts[ loaded_scripts.length - 1 ];
            var name = last_loaded.original_src.split('?')[0];

            name = `<div class="script-loaded"><img class="jsicon" src='assets/js_icon.png'><p>
                ` + name;
            $("#import-names").append(name+"</p></div>");
            $("#import-names").append("</br>Loaded</br>");    
            $("#import-names").append("Setting up environment</br>");
            CORE = new Core();
        }

        function onProgress(name, num)
        {
            var factor = (num) / parseFloat(that.totalImports) * 100;

            $("#import-text").html(parseInt(factor)+"%");
            $("#import-bar").css('width', parseInt(factor)+"%");

            name = `<div class="script-loaded"><img class="jsicon" src='assets/js_icon.png'><p>
                ` + name.split('?')[0];
            $("#import-names").append(name+"</p></div>");
            pageScroll();

            function pageScroll() {

                var magic = 19.357142857142858;
                var max = (that.totalImports) * magic;

                if($("#import-names")[0].scrollTop < max) {
                    $("#import-names")[0].scrollBy(0,2);
                    scrolldelay = setTimeout(pageScroll,30);
                }
                else
                {
                    $("#import-names")[0].scrollBy(0,magic);
                }
            }
        }

        function onError(error, name)
        {
            console.error("Error loading script " + name);
        }
    },

    registerTonemapper: function( base_class, name )
    {
        // Control that param has necessary items
        if(!base_class || !base_class.constructor)
        throw('tonemapper class needed');

        //extend class
        if(base_class.prototype) //is a class
            for(var i in Tonemapper.prototype)
                if(!base_class.prototype[i])
                    base_class.prototype[i] = Tonemapper.prototype[i];

        var instance = new base_class();
        var fs_code = instance.injectCode( base_class );
        var name = name || base_class.name;

        instance.vs = Shader.SCREEN_VERTEX_SHADER;
        instance.fs = fs_code;
        
        this.tonemappers[name] = instance;
    },

    registerComponent: function( base_class, name )
    {
        // Control that param has necessary items
        if(!base_class || !base_class.constructor)
        throw('component class needed');

        var instance = new base_class();

        if(instance.setup)
        instance.setup();

        var name = name || base_class.name;
        this.components[name] = instance;
    },

	registerShader: function( base_class, name )
    {
        // Control that param has necessary items
        if(!base_class || !base_class.constructor)
        throw('component class needed');

        var instance = new base_class();

        if(instance.setup)
        instance.setup();

        var name = name || base_class.name;
        this.shaders[name] = instance;
    },

    // Get component
    get: function( component_name )
    {
        var c = this.components[component_name];
        //if(!c) console.warn('no component called ' + component_name);
        return c;
    }
};