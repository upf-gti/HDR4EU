/*
*   Alex Rodriguez
*   @jxarco 
*/

/**
* Responsible for graph canvas and nodes
* @class 
*/

class GraphManager {

    constructor()
    {
        this.graph = new LGraph();
        this.graph_canvas = new LGraphCanvas("#graph_canvas", this.graph);

        this.setup();
        this.init();
    }

    setup()
    {
        // default render pipeline

        var frame_node = LiteGraph.createNode("texture/frame");
        frame_node.pos = [150,150];
        this.graph.add(frame_node);

        var glow_node = LiteGraph.createNode("texture/glow");
        glow_node.properties.threshold = 20;
        glow_node.pos = [530, 70];
        this.graph.add(glow_node);

        var tm_node = LiteGraph.createNode("texture/tonemapping");
        tm_node.pos = [950, 70];
        this.graph.add(tm_node);

        var viewport_node = LiteGraph.createNode("texture/toviewport");
        viewport_node.pos = [1275,180];
        this.graph.add(viewport_node);

        var uniforms_node = LiteGraph.createNode("scene/uniforms");
        uniforms_node.pos = [745,140];
        this.graph.add(uniforms_node);

        frame_node.connect(0, glow_node, 0 );
        glow_node.connect(0, tm_node, 0 );
        uniforms_node.connect(0, tm_node, 1 );
        tm_node.connect(0, viewport_node, 0 );

        var vfx_group = new LiteGraph.LGraphGroup("VFX");
        vfx_group.pos = [460, 10];
        vfx_group.size = [670, 180];
        this.graph.add(vfx_group);

        this.viewport_node = viewport_node;

        var nodes_types = LiteGraph.registered_node_types;

        // setup onInspect method to registered graph nodes
        for(var type in nodes_types)
            nodes_types[type].prototype.onDblClick = this.onInspectNode;
    }

    init()
    {
        this.graph.start();
    }

    open()
    {
        this.graph_canvas = new LGraphCanvas("#graph_canvas", this.graph);
        this.graph.start();
        resize(); // resize both canvas
    }

    onInspectNode(event)
    {
        if(!CORE)
        return;

        var rightpanel = CORE.gui._sidepanel;
        rightpanel.clear();

        var widgets = new LiteGUI.Inspector();
        rightpanel.add( widgets );

        widgets.addButton(null, "Return to root", {callback: function(){

            gui.updateSidePanel(null, 'root');

        }});

        widgets.addSection("Scene Graph");
        widgets.addTitle(this.type);

        var that = this;

        // Node information here
        widgets.widgets_per_row = 2;
        widgets.addString("Title", this.title, {width: "65%", name_width: "30%", callback: function(v){
            nodes_types[nt].title = v;
        }});
        widgets.addString("ID", this.id, {width: "35%", name_width: "30%", disabled: true});
        widgets.widgets_per_row = 1;
        widgets.addVector2("Size", this.size, {callback: function(v){
            that.size = v;
        }});

        var modes = ["Always", "On Event", "On Trigger", "Never"];
        var _mode = modes[this.mode];

        widgets.addCombo("Mode", _mode, {values: modes, callback: function(v){
            switch (v) {
                case "On Event":
                    that.mode = LiteGraph.ON_EVENT;
                    break;
                case "On Trigger":
                    that.mode = LiteGraph.ON_TRIGGER;
                    break;
                case "Never":
                    that.mode = LiteGraph.NEVER;
                    break;
                case "Always":
                default:
                    that.mode = LiteGraph.ALWAYS;
                    break;
            }
        }});
        
        // Node properties here
        widgets.addTitle("Properties");

        for(let p in this.properties)
        {
            var value = this.properties[p];

            switch (value.constructor) {
                case Boolean:
                    widgets.addCheckbox(p, value, {callback: function(v){ that.properties[p] = v; that[p] = v;  }});
                    break;
                case Number:
                    widgets.addNumber(p, value, {callback: function(v){ that.properties[p] = v; that[p] = v;  }});
                    break;
                case Array:
                case Float32Array:
                    widgets.addVector(p, value, {callback: function(v){ that.properties[p] = v; that[p] = v;  }}, value.length);
                    break;
                case String:
                default:
                    widgets.addString(p, value, {callback: function(v){ that.properties[p] = v; that[p] = v;  }});
            }
        }
    }

    resize()
    {
        var graph_area = document.querySelector("#graph_area");

        if(!graph_area)
            return;

        this.graph_canvas.resize(graph_area.clientWidth - 8, graph_area.clientHeight - 8);
    }

    drawGUI(inspector)
    {
        var that = this;

        window.graphSection = inspector.addSection("FXGraph", {collapsed: graphSectionCollapsed, callback: function(no_collapsed){
			graphSectionCollapsed = !no_collapsed;
		}});
		inspector.widgets_per_row = 2;
		inspector.addCheckbox("Redraw", this.graph_canvas.always_render_background, {callback: function(v) { 
			that.graph_canvas.always_render_background = v;
        }});
        inspector.addCheckbox("Pause", this.graph_canvas.pause_rendering, {callback: function(v) { 
			that.graph_canvas.pause_rendering = v;
		}});
		inspector.addSeparator();
		inspector.addButton(null, "Edit", {callback: function() { gui.createBottomPanel(); }});

    }
}