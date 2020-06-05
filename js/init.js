/*
*   Alex RodrÃ­guez
*   @jxarco 
*/

var CORE            = null,
    LOAD_STEPS      = 6,
    STEPS           = 0,
    _dt             = 0.0,
	postFrame	    = 0.0
    tFrame		    = 0.0,
    maxScrollTop    = null,
    SCENE_TAB       = 0,
    HDRI_TAB        = 1;

var js_img = '<img class="jsicon" src="imgs/js_icon.png">';
var userAgent = (navigator && navigator.userAgent || '').toLowerCase();
var vendor = (navigator && navigator.vendor || '').toLowerCase();

var ResourceManager = RM = {

    version: 1.0,
    nocache: false,
    debug_imports: false,
    formats: {},

    MODELS_FOLDER: "data/models/",
    TEXTURES_FOLDER: "data/textures/hdre/",

    shader_macros: {
        'GAMMA': 2.2,
        'N_SAMPLES': 4096
    },

    tonemappers: {},
    components: {},
    classes: {},
    shaders: {},

    node_components: [],

    FORWARD:	00,
    DEFERRED:	01,

    init: function()
    {
        console.log("Loading application, please wait");
        this.setup();
        this.onInit();
    },

    setup: function()
    {
        console.log("Running at %c" + (isMobile ? "mobile " : "")  + this.browser(), "color: red; font-weight: 900;" );
        
        $(document.body).append(
        '<div id="canvas-tools">' +
        '    <div class="tool-section tool-section-manipulate">' +
		'        <div class="tool-button tool-showgrid enabled" title="Show grid" style="background-position: 0.16em 0.16em; background-image: url(https://webglstudio.org/latest/imgs/mini-icon-grid.png)"></div>' +
        '        <div class="tool-button tool-deferredtex" title="Show deferred textures" style="background-image: url(https://webglstudio.org/latest/imgs/mini-icon-depth.png)"></div>' +
        '        <div class="tool-button tool-forcerender" title="Force render all frames" style="background-image: url(https://webglstudio.org/latest/imgs/mini-icon-film.png)"></div>' +
        '    </div>' +
        '</div>'
        );
        
        QueryString = function() {
            // the return value is assigned to QueryString!
            var query_string = {};
            var query = window.location.search.substring(1);
            var vars = query.split("&");
            for (var i=0;i<vars.length;i++) {
              var pair = vars[i].split("=");
                  // If first entry with this name
              if (typeof query_string[pair[0]] === "undefined") {
                query_string[pair[0]] = decodeURIComponent(pair[1]);
                  // If second entry with this name
              } else if (typeof query_string[pair[0]] === "string") {
                var arr = [ query_string[pair[0]],decodeURIComponent(pair[1]) ];
                query_string[pair[0]] = arr;
                  // If third or later entry with this name
              } else {
                query_string[pair[0]].push(decodeURIComponent(pair[1]));
              }
            } 
              return query_string;
          }();
    },

    onInit: function()
    {
        if(isMobile)
        {
            var error = '<div class="script-loaded">Browser not supported<p></p></div>';
            $("#import-names").append("<div class='script-loaded'><p></p></div>");
            $("#import-names").append(error);
            return;
        }

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
    
        if(isMobile)
            import_list = import_list.filter( e => !e.includes("tinyexr.js"))

        if(this.nocache) {
            var nocache = "?nocache" + performance.now();
            for(var i in import_list)
            import_list[i] += nocache;
        }

        this.totalImports = import_list.length;
        LiteGUI.requireScript(import_list, onLoad, onError, onProgress);

        function onLoad(loaded_scripts)
        {
            var last_loaded = loaded_scripts[ loaded_scripts.length - 1 ];
            var name = last_loaded.original_src.split('?')[0];

            name = '<div class="script-loaded">' + js_img + '<p>' + name;
            $("#import-names").append(name+"</p></div>");
            $("#import-names").append("<br><br>");    
            $("#import-names").append("<b>Setting up environment...<b>");
            $("#import-names").append("<br>");
            
            //console.log($("#import-names")[0].scrollTop);
            
            setTimeout(() => {
                
                if(!CORE)
                    CORE = new Core();

            }, 5000);
        }

        function onProgress(name, num)
        {
            var factor = (num) / parseFloat(that.totalImports);

            $("#import-text").html(parseInt(factor)+"%");

			var old = parseFloat( $("#import-bar").css('width') );
			var parent = parseFloat( $("#import-container").css('width') );
			var value = factor * parent;

            name = '<div class="script-loaded">' + js_img + '<p>' + name.split('?')[0].replace("https://", "");
            $("#import-names").append(name+"</p></div>");
            pageScroll();

            function pageScroll() {

                if(CORE)
                return;
               
                var magic = 20.557142857142858;
                var max = (that.totalImports) * magic;

                var scrollValue = ($("#import-names")[0].scrollTop / max) * 100;
                $("#import-bar").css('width', scrollValue + "%");

                if(scrollValue >= 100)
                    CORE = new Core();


                if($("#import-names")[0].scrollTop < max) {
                    $("#import-names")[0].scrollBy(0,1);
                    scrolldelay = setTimeout(pageScroll, 35);
                }
                else
                {
                    $("#import-names")[0].scrollBy(0,magic);
                }
            }
        }

        function onError(e, name)
        {
            var html = '<div class="script-loaded">' + js_img + '<p style="color:rgb(255, 150, 150)";>' + name.split('?')[0];
            $("#import-names").append(html+"</p></div>");
            console.error("Error loading script " + name);
        }
    },

	addSupportedFormat: function( extensions, info)
	{
		if( extensions.constructor === String )
			extensions = extensions.split(",");

		for(var i = 0; i < extensions.length; ++i)
		{
			var extension = extensions[i].toLowerCase();
			if( this.formats[ extension ] )
				console.warn("There is already another parser associated to this extension: " + extension);
			this.formats[ extension ] = info;
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

        instance.vs = instance.assembling ? Shader.QUAD_VERTEX_SHADER : Shader.SCREEN_VERTEX_SHADER;
        instance.fs = fs_code;
        
        this.tonemappers[name] = instance;
    },

    registerComponent: function( base_class, name )
    {
        // Control that param has necessary items
        if(!base_class || !base_class.constructor)
        throw('component class needed');

        if( this.components[name] ) {
            console.error("Component already added");
            return;
        }

        base_class.prototype.fromJSON = function( copy )
        {
            //copy to attributes
            for(var i in copy)
            {
                var v = this[i];
                if(v === undefined)
                    continue;

                if( v && v.constructor === Float32Array )
                    v.set( copy[i] );
                else 
                    this[i] = copy[i];
            }

            if(this.onImport)
                this.onImport();
        }

        var instance = new base_class();

        if(instance.setup)
        instance.setup();

        var name = name || base_class.name;
        this.components[name] = instance;

        return instance;
    },

    registerClass: function( base_class, name )
    {
        // Control that param has necessary items
        if(!base_class || !base_class.constructor)
        throw('component class needed');

        if( this.components[name] ) {
            console.error("Component already added");
            return;
        }

        var name = name || base_class.name;
        this.classes[name] = base_class;
    },

	registerNodeComponent: function( base_class, name )
    {
        // Control that param has necessary items
        if(!base_class || !base_class.constructor)
        throw('component class needed');

        this.node_components.push( {
			name: "<img style='width: 16px; vertical-align: text-bottom;' src='" + base_class.icon + "'>" + name,
			short_name: name,
			base_class: base_class
		});
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
    Get: function( component_name )
    {
        var c = this.components[component_name];
        /* if(!c) 
            console.warn('no component called ' + component_name); */
        return c;
    },

    browser: function()
    {
        if(isSafari && isSafari())
            return 'safari';
        if(isOpera && isOpera())
            return 'opera';
        if(isChrome && isChrome())
            return 'chrome';
        if(isFirefox && isFirefox())
            return 'firefox';
        if(isEdge && isEdge())
            return 'edge';
    }
};

var isSafari = function()
{
    var match = userAgent.match(/version\/(\d+).+?safari/);
    return match !== null;
}

var isEdge = function()
{
    var match = userAgent.includes("edge");
    return match;
}

var isOpera = function()
{
    var match = userAgent.match(/(?:^opera.+?version|opr)\/(\d+)/);
    return match !== null;
}

var isChrome = function()
{
    var match = /google inc/.test(vendor) ? userAgent.match(/(?:chrome|crios)\/(\d+)/) : null;
    return match !== null && !isOpera();
}

var isFirefox = function()
{
    var match = userAgent.match(/(?:firefox|fxios)\/(\d+)/);
    return match !== null;
}

var isMobile = (function()
{
    return /android/.test(userAgent) || /mobile/.test(userAgent);
})();