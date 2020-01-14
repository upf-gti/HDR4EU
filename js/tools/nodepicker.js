/*
*   Alex Rodriguez
*   @jxarco 
*/

function NodePicker()
{
    if(this.constructor !== NodePicker)
        throw("Use new");
    
    this.selected = null;
}

Object.assign( NodePicker.prototype, {

    setup() {

    },

    select(node, multiple) {

        if(node.constructor !== RD.SceneNode)
        throw("bad param");
    
        if(multiple && this.selected)
        {
            if(this.selected && this.selected.constructor !== Array && this.selected._uid !== node._uid)
                this.selected = [].concat([this.selected, node]);
            else if(this.selected && this.selected.constructor === Array)
            {
                var isSelected = this.selected.filter(e=>e._uid === node._uid).length > 0;
                if(!isSelected)
                    this.selected.push(node);   
                else { // unselect

                    this.selected = this.selected.filter(e=>e._uid !== node._uid);
                   
                    switch (this.selected.length) {
                        case 0:
                            this.unSelect();   // delete "lines" meshes
                            break;
                        case 1:
                            this.selected = this.selected[0]; // select last node
                            
                            // no array of nodes
                            window.nodes = undefined;
                            window.node = this.selected;

                            // parent is not the scene root
                            var name = this.selected.name;
                            if(!name)
                                name = this.selected.parentNode.name;
                            gui.updateSidePanel(null, name);
                            return; // important return
                    }
                }
            }
                

            window.nodes = this.selected;
            window.node = undefined;
        }
        else
        {
            this.selected = node;
            window.node = node;   
            window.nodes = undefined; 
        }
    },

    unSelect()
    {
        this.selected = null;
        window.node = undefined;
        window.nodes = undefined;
        delete gl.meshes['lines'];
    },


    delete() {

        var nodes = this.selected;

        if(!nodes)
        return;

        nodes = [].concat(nodes); // always an array

        for(var n = 0; n < nodes.length; ++n)
        {
            var node = nodes[n];

            if(node.components && node.components["Light"])
            node.components["Light"].remove();

            node.destroy();
            node = null;

            // why am I doing this ? wrong copy paste?
            /*for(var t in gl.textures)
                if(t.includes( this._last_environment ))
                    delete gl.textures[t];*/
        }

        CORE.destroyByName("lines");
        delete gl.meshes['lines'];
        this.unSelect();

        setTimeout( function(){
            gui.updateSidePanel(null, "root");
        }, 100 );
    },

    update() {

        if(!this.selected)
        return;

        var nodes = [].concat(this.selected); // always an array 
        var root = CORE.root;
        var vertices = [];

        for(var n = 0; n < nodes.length; ++n)
        {
            // update all boundings
            var node = nodes[n];

            var bb = gl.meshes[node.mesh].bounding,
            globalMat = node.getGlobalMatrix();

             // Get points
            var corners = Tools.getBBCorners(bb);

             // Transform points
            for(var i = 0; i < corners.length; i++)
            {
                var res = vec3.create(),
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

            for(var i = 0; i < points.length; ++i)
                    vertices.push(points[i][0], points[i][1], points[i][2]);
        }

        if(!gl.meshes["lines"])
        {
            var mesh = GL.Mesh.load({ vertices: vertices });
            gl.meshes["lines"] = mesh;
            var l = new RD.SceneNode();
            l.flags.ignore_collisions = true;
            l.primitive = gl.LINES;
			l.layers = 4;
            l.mesh = "lines";
            l.name = "lines";
            l.color = [1,1,1,1];
            l.shader = "lines";
            root.addChild(l);
        }
        else
        {
            var mesh = gl.meshes["lines"];

            if(mesh.getBuffer('vertices').data.length !== vertices.length)
            {
                var mesh = GL.Mesh.load({ vertices: vertices });
                gl.meshes["lines"] = mesh;
            }
            else
            {
                mesh.getBuffer("vertices").data.set( vertices );
                mesh.getBuffer("vertices").upload( GL.STREAM_DRAW );    
            }
        }
    }
} );

RM.registerComponent( NodePicker, 'NodePicker');