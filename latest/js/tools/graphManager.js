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
        frame_node.pos = [75,150];
        this.graph.add(frame_node);

        var glow_node = LiteGraph.createNode("texture/glow");
        glow_node.properties.threshold = 20;
        glow_node.pos = [750, 70];
        this.graph.add(glow_node);

        var tm_node = LiteGraph.createNode("texture/tonemapping");
        tm_node.pos = [1085, 70];
        this.graph.add(tm_node);

        var viewport_node = LiteGraph.createNode("texture/toviewport");
        viewport_node.onRenderFX = CORE.onRenderFX.bind(CORE);
        viewport_node.pos = [1375,180];
        this.graph.add(viewport_node);

        var uniforms_node = LiteGraph.createNode("scene/uniforms");
        uniforms_node.pos = [850,160];
        this.graph.add(uniforms_node);
        uniforms_node.collapse(true);

        frame_node.connect(0, glow_node, 0 );
        glow_node.connect(0, tm_node, 0 );

        // uniforms_node.connect(0, tm_node, 1 );

        // scale average luminance
        var widget_node = LiteGraph.createNode("widget/hslider");
        widget_node.properties["min"] = 1.0;
        widget_node.properties["max"] = 10.0;
        widget_node.pos = [745,240];
        widget_node.value = 0.1;
        this.graph.add(widget_node);

        window.wid = widget_node;

        var operation_node = LiteGraph.createNode("math/operation");
        operation_node.properties["OP"] = "*";
        operation_node.pos = [955,240];
        this.graph.add(operation_node);

        uniforms_node.connect(0, operation_node, 0 );
        widget_node.connect(0, operation_node, 1 );
        operation_node.connect(0, tm_node, 1 );
        //

        var ssao_node = LiteGraph.createNode("fx/ssao");
       
        this.graph.add(ssao_node);
        ssao_node.collapse(true);
        ssao_node.pos = [420, 100];
        frame_node.connect(0, ssao_node, 0 );
        frame_node.connect(1, ssao_node, 1 );
        frame_node.connect(2, ssao_node, 2 );
        frame_node.connect(4, ssao_node, 3 );

        var light_node = LiteGraph.createNode("fx/lighting");
        light_node.pos = [560, 235];
        this.graph.add(light_node);
        light_node.collapse(true);
        
        ssao_node.connect(0, light_node, 0 );
        frame_node.connect(1, light_node, 1 );
        frame_node.connect(2, light_node, 2 );
        frame_node.connect(3, light_node, 3 );
        frame_node.connect(4, light_node, 4 );

        light_node.connect(0, glow_node, 0 );
        tm_node.connect(0, viewport_node, 0 );

        var vfx_group = new LiteGraph.LGraphGroup("FX");
        vfx_group.color = "#b06634";
        vfx_group.pos = [345, 10];
        vfx_group.size = [925, 160];
        this.graph.add(vfx_group);

        this.viewport_node = viewport_node;

        var nodes_types = LiteGraph.registered_node_types;

        // setup onInspect method to registered graph nodes
        for(var type in nodes_types)
            nodes_types[type].prototype.onDblClick = this.onDblClick;
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

    onInspect(inspector)
    {
        var that = this;
        inspector.clear();

        window.graphSection = inspector.addSection("FX Graph", {collapsed: graphSectionCollapsed, callback: function(no_collapsed){
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
        
        inspector.widgets_per_row = 1;
        inspector.addTitle( "Nodes" );
        for( let i in this.graph._nodes_in_order )
            if(Object.keys( this.graph._nodes_in_order[i].properties ).length)
                inspector.addButton(this.graph._nodes_in_order[i].title, "Edit", {name_width: "70%",width: "60%", callback: function() { 
                    that.onInspect(inspector);
                    that.onInspectNode(that.graph._nodes_in_order[i], inspector); 
                }});

        inspector.addSeparator();
        inspector.addButton(null, "Open graph", {callback: function() { gui.createBottomPanel(); }});
        inspector.addSeparator();
    }

    onDblClick(e, pos)
    {
        if(!CORE)
        return;

        var rightpanel = CORE.gui._sidepanel;
        rightpanel.clear();

        CORE.graph_manager.onInspectNode( this, rightpanel );
    }

    onInspectNode( node, root )
    {
        if(!CORE || !root)
        throw("no core or root");

        var widgets = new LiteGUI.Inspector();
        var no_opening = false;
        
        if(root.constructor === Inspector) {
            widgets = root;
            no_opening = true;
        }
        else
            root.add( widgets );

        if(!no_opening)
        {
            widgets.addButton(null, "Return to root", {callback: function(){

                gui.updateSidePanel(null, 'root');
    
            }});
    
            widgets.addSection("Scene Graph");
        }
        
        widgets.addTitle(node.type);

        // Node information here
        widgets.widgets_per_row = 2;
        widgets.addString("Title", node.title, {width: "65%", name_width: "30%", callback: function(v){
            nodes_types[nt].title = v;
        }});
        widgets.addString("ID", node.id, {width: "35%", name_width: "30%", disabled: true});
        widgets.widgets_per_row = 1;
        widgets.addVector2("Size", node.size, {callback: function(v){
            node.size = v;
        }});

        widgets.addVector2("Position", node.pos, {callback: function(v){
            node.pos = v;
        }});

        var modes = ["Always", "On Event", "On Trigger", "Never"];
        var _mode = modes[node.mode];

        widgets.addCombo("Mode", _mode, {values: modes, callback: function(v){
            switch (v) {
                case "On Event":
                    node.mode = LiteGraph.ON_EVENT;
                    break;
                case "On Trigger":
                    node.mode = LiteGraph.ON_TRIGGER;
                    break;
                case "Never":
                    node.mode = LiteGraph.NEVER;
                    break;
                case "Always":
                default:
                    node.mode = LiteGraph.ALWAYS;
                    break;
            }
        }});
        
        // Node properties here
        if(Object.keys(node.properties).length)
            widgets.addTitle("Properties");

        for(let p in node.properties)
        {
            var value = node.properties[p];

            switch (value.constructor) {
                case Boolean:
                    widgets.addCheckbox(p, value, {callback: function(v){ node.properties[p] = v; node[p] = v;  }});
                    break;
                case Number:
                    widgets.addNumber(p, value, {step: value/100, callback: function(v){ node.properties[p] = v; node[p] = v;  }});
                    break;
                case Array:
                case Float32Array:
                    widgets.addVector(p, value, {callback: function(v){ node.properties[p] = v; node[p] = v;  }}, value.length);
                    break;
                case String:
                default:
                    widgets.addString(p, value, {callback: function(v){ node.properties[p] = v; node[p] = v;  }});
            }
        }

        if(node.onInspect)
        node.onInspect(widgets);
    }

    resize()
    {
        var graph_area = document.querySelector("#graph_area");

        if(!graph_area)
            return;

        this.graph_canvas.resize(graph_area.clientWidth - 8, graph_area.clientHeight - 8);
    }

    isUsed()
    {
        return this.viewport_node.getInputData(0);
    }
}