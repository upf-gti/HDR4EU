/*
*   Alex Rodriguez
*   @jxarco 
*/


var last_environment = "no_loaded";
var _dt;

var skybox      = null;
var FS          = null;
var controller  = null;
var scene       = null;

var tmpFiles = {};

var REPO = {
    
    init(){

        var that = this;

        FS = new FileSystem( function(){

            that.showFiles();
    
        } );
        
        var headerHeight = document.querySelector("header").clientHeight;
        var navSearchHeight = document.querySelector("#navbar-search").clientHeight;
        document.querySelector("#album-box").style.height = (window.innerHeight - (headerHeight + navSearchHeight)) + "px";

        var context = GL.create({ width: window.innerWidth, height: window.innerHeight });
    
        renderer = new RD.Renderer( context, {
            autoload_assets: true,
            shaders_file: "shaders.glsl"
        });
    
        renderer.canvas.id = "mycanvas";
        document.querySelector("#canvas_container").appendChild(renderer.canvas);
    
        skybox = new RD.SceneNode();
        skybox.mesh = "cube";
        // skybox.shader = "skybox";
        skybox.flags.depth_test = false;
        skybox.flags.flip_normals = true;
        skybox.render_priority = RD.PRIORITY_BACKGROUND;
        skybox.scaling = 1000;
        skybox.color = [0.82, 0.83, 0.84, 1];
    
        node = new RD.SceneNode();
        node.mesh = "sphere";
        node.shader = "mirror";
        node.color = RD.WHITE;
        node.position = [1, 0, 0];
        node.visible = false;

        node_irradiance = new RD.SceneNode();
        node_irradiance.mesh = "sphere";
        node_irradiance.shader = "mirror";
        node_irradiance.color = RD.WHITE;
        node_irradiance.position = [-1, 0, 0];
        node_irradiance.visible = false;

        PBR.init();
    
        var container = document.querySelector("#canvas_container");
        
        renderer.canvas.width = w = container.clientWidth;
        renderer.canvas.height = h = container.clientHeight - 188;
        renderer.context.viewport(0, 0, w, h);

        renderer._uniforms["u_exposure"] = 1;
        renderer._uniforms["u_tonemap"] = true;
        renderer._uniforms["u_gamma"] = true;
        renderer._uniforms["u_flipX"] = false;
    
        scene       = new RD.Scene();
        controller  = new CameraController();
    
        // add nodes to scene
        scene.root.addChild(skybox);
        scene.root.addChild(node);
        scene.root.addChild(node_irradiance);
    
        renderer.context.ondraw = function(){ 
    
            gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
            renderer.clear([0.82, 0.83, 0.84]);
            renderer.render( scene, controller.camera );
    
        };
        renderer.context.onupdate = function(dt){ 
            _dt = dt;
    
            if(window.destination_eye)
                vec3.lerp(controller.camera.position, controller.camera.position, window.destination_eye, 0.3);
    
        };
        renderer.context.animate();
    
        this.bindMouse(renderer.context);
        this.bindDOM();

        
    },

    bindDOM() {

        var that = this;

        // enable popovers
        $(function () {
            $('[data-toggle="popover"]').popover()
          })

        var search_input = document.querySelector("#search-box");
        var search_button = document.querySelector("#search-box-btn");

        search_input.addEventListener("keydown", function(e){

            if(e.keyCode === 13)
                that.showFiles(this.value);
        });

        var tool_tonemap = document.querySelector(".tool-tonemap");
        var tool_gamma = document.querySelector(".tool-gamma");
        var tool_flip = document.querySelector(".tool-flipX");

        tool_tonemap.addEventListener("click", function(e){

            renderer._uniforms["u_tonemap"] = !renderer._uniforms["u_tonemap"];
        
            if(renderer._uniforms["u_tonemap"])
                $(this).addClass("enabled");
            else 
                $(this).removeClass("enabled");
        });

        tool_gamma.addEventListener("click", function(e){

            renderer._uniforms["u_gamma"] = !renderer._uniforms["u_gamma"];
        
            if( renderer._uniforms["u_gamma"])
                $(this).addClass("enabled");
            else 
                $(this).removeClass("enabled");
        });

        tool_flip.addEventListener("click", function(e){

            renderer._uniforms["u_flipX"] = !renderer._uniforms["u_flipX"];
        
            if( renderer._uniforms["u_flipX"])
                $(this).addClass("enabled");
            else 
                $(this).removeClass("enabled");
        });

        document.querySelector("#formModalCenter").querySelector("#hdre-tags").addEventListener("keyup", function(e){

            let value = this.value.toLowerCase();
            value = value.replaceAll({" ": ""});

            if(e.keyCode === 32)
            {
                var badge = document.createElement("span");
                badge.innerText = value;
                badge.className = "badge badge-pill badge-success";
                badge.style.marginRight = "3px";

                badge.addEventListener("click", function(e){

                    this.remove();

                });

                document.querySelector("#formModalCenter").querySelector("#tags-container").append(badge);
                this.value = "";
            }

        });
        
        $("#upload-form").submit(function() {
            
            if(!tmpEventFile)
            return;

            var inputs = $("#upload-form :input");
            var tagsDom = $("#upload-form .badge-success");

            var values = {};
            var tags = [];
			
			for(var i in inputs ){
				var input = inputs[i];
				values[input.id] = input.value;
            }
            
            for(var i = 0; i < tagsDom.length; i++){
				tags.push( tagsDom[i].innerText );
			}

			var metadata = {
                tags: tags,
                size: tmpEventFile.size
            };

            var filereader = new FileReader();
            filereader.onload = function(e)
            {
                if(HDRTool.parseHDRE(e.target.result, tmpEventFile.name))
                    createPreview(tmpEventFile.name);

                FS.uploadFile("hdre", tmpEventFile, metadata).then(function(){

                    $("#formModalCenter").modal("hide");
                    that.showFiles();
                });
                
            }
            filereader.readAsArrayBuffer(tmpEventFile);
           
        });
        
        var copyLinkButton = document.querySelector("#copyLink");

        copyLinkButton.onclick = function() {
          
            that.copyFullPath();
        };

        var drop_container = document.querySelector("#mycanvas");
        var domElement = document.querySelector(".album");

        drop_container.ondragenter = (e) => { $(domElement).addClass("dragging"); return false;};
        drop_container.ondragleave = (e) => {$(domElement).removeClass("dragging"); return false;};
        drop_container.ondragover = (e) => {return false;};
        drop_container.ondrop = (e) => this.onDropFile(e, domElement);
    },

    onDropFile(e, domElement)
    {
        e.preventDefault();
        e.stopPropagation();

        $(domElement).removeClass("dragging");
        this.setFormDOM(e);
    },

    bindMouse(ctx) {

        var s = 0.25;
    
        ctx.captureMouse(true);
    
        ctx.onmousemove = function(e)
        {
            if(!e.dragging) return;
    
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
    
            var amount =  (1 + e.delta * -0.05);
            controller.changeDistance(amount);
        }
    
    },    

    showFiles(box_search)
    {
        var that = this;

        $(document.querySelector("#card_box")).empty();

        FS.getFiles( "hdre" ).then( function(files) { 

            if(box_search)
            {
                if(box_search[0] === "@")
                    files = files.filter(e=>e.metadata.tags.includes(box_search.substring(1)))
                else
                    files = files.filter(e=>e.filename.includes(box_search))
            }

            console.log(files);
            $(".progress-bar").css("width", "25%");

            for(let i in files) {
                
                var filename = files[i].filename;

                if(!tmpFiles[filename])
                tmpFiles[filename] = files[i];
               
                that.createCard(files[i]);
                
                $(".progress-bar").css("width", 25 + ((i+1)/files.length) * 75 + "%");
            }

            
            if(files.length)
            {
                var on_read = function(filename, header){
                    var tex_name = HDRTool.getName( filename );
                    last_environment = skybox.texture = tex_name;
                    node.visible = node_irradiance.visible = true;

                    // node skybox
                    skybox.shader = "skybox";

                    // node pbr
                    PBR.setTextures(node, tex_name);
                    node.shader = "pbr";

                    Object.assign( node.uniforms, PBR.getUniforms(0, 1) );

                    // node irradiance pbr
                    PBR.setTextures(node_irradiance, tex_name);
                    node_irradiance.shader = "pbr";

                    Object.assign( node_irradiance.uniforms, PBR.getUniforms(1, 0) );

                    if(file)
                        that.setModalDOM(file, pretty_filename, header);
                }

                if( QueryString['hdre'] )
                {
                    var filename = FS.root  + "/8efb30d54aee665af72c445acf53284b/hdre/" + QueryString['hdre'];
                    PBR.setHDRE(filename, on_read);
                }
                else
                {
                    var file = files[0];
                    var fullpath = file.fullpath;
                    var filename = FS.root  + fullpath;
                    var pretty_filename = file.filename.replace(".hdre", "").replaceAll({"_": " "});
                    pretty_filename = pretty_filename.charAt(0).toUpperCase() + pretty_filename.slice(1);
    
                    PBR.setHDRE(filename, on_read);
                }
            }

            setTimeout(() => {
                $(".modalbg").hide('explode');
            }, 500);
        });
    },

    download(file)
    {
        LiteGUI.downloadURL(FS.root + tmpFiles[ file ].fullpath, file)
    },

    createCard(file)
    {
        var that = this;

        var path = 'https://webglstudio.org/users/hermann/files/sauce_dev/files/8efb30d54aee665af72c445acf53284b/thb/thb_' + file.filename + '.png';
        var card = document.createElement("div");
        card.className = "col-md-3";

        var html = "";
        let filename = file.filename;
        let pretty_filename = filename.replace(".hdre", "").replaceAll({"_": " "});
        pretty_filename = pretty_filename.charAt(0).toUpperCase() + pretty_filename.slice(1);

        var filesize = file.metadata.size;

        if(filesize === undefined)
            filesize = 0;

        html = `
            <div class="card mb-4 box-shadow" style="overflow:hidden;">
                <img class="card-img-top img-tricky" data-path="` + file.fullpath + `" src="` + path + `" alt="` + filename + `">
                <!-- <small style="position: absolute; font-size: 9px; float: right; margin-top: 225px; right: 10px;" class="text-muted">` + getDate() + `</small> -->
                <div class="card-body">
                    <p class="card-text">` + pretty_filename + `</p>
                    <div class="d-flex justify-content-between align-items-center">`;
                        
        //if(file.metadata.tags.length) {
        
        html += `<div class="btn-group">`;

            for(var i in file.metadata.tags)
            html += `<button type="button" class="btn btn-micro btn-outline-success">` + file.metadata.tags[i] + `</button>`;
                    
            if(!file.metadata.tags || !file.metadata.tags.length)
                html += `<button type="button" class="btn btn-micro btn-outline-danger" style="color: red;">` + `No tags` + `</button>`;


        html += `</div>`;
        //}

        html += `
                    
                </div>
                <br>
                <button type="button" class="btn btn-micro btn-outline-info">Download</button>
                <small style="float: right; margin-top: 5px;" class="text-muted">` + filesize.toFixed(2) + ` MB</small>
                <br>
                <small style="float: right; margin-top: 5px;" class="text-muted maxLum"></small>
                </div>
            
        </div>`;

        card.innerHTML = html;

        card.querySelector("img").addEventListener("click", function(e){

            var fullpath = this.dataset["path"];
            var filename = FS.root  + fullpath;
            let file_used = file;

            var tex_name = HDRTool.getName( filename );

            if(tex_name == last_environment)
            return;

            PBR.setHDRE(filename, function(filename, header){

                // delete previous em (free memory)
                for(var t in gl.textures)
                if(t.includes( last_environment ))
                    delete gl.textures[t];

                var tex_name = HDRTool.getName( filename );
                last_environment = skybox.texture = tex_name;
                node.visible = node_irradiance.visible = true;

                // node skybox
                skybox.shader = "skybox";

                // node pbr
                PBR.setTextures(node, tex_name);
                node.shader = "pbr";

                Object.assign( node.uniforms, PBR.getUniforms(0, 1));

                // node irradiance pbr
                PBR.setTextures(node_irradiance, tex_name);
                node_irradiance.shader = "pbr";

                Object.assign( node_irradiance.uniforms, PBR.getUniforms(1, 0) );

                that.setModalDOM(file, pretty_filename, header);
            });
            
        });

        var tags = card.querySelectorAll(".btn-outline-success");
        for(var i = 0; i < tags.length; i++)
            tags[i].addEventListener("click", function(e){

                that.searchByTag(this.innerText);
            });

        card.querySelector(".btn-outline-info").addEventListener("click", function(e){

            that.download(filename);
        });

        card.querySelector(".img-tricky").addEventListener("touchmove", function(e){

            var clientX = e.touches[0].clientX;
            var clientY = e.touches[0].clientY;

            if(!this.mouse) {
                this.mouse = [clientX, clientY];
                return;
            }
            
            var deltaX = clientX - this.mouse[0];

            // update mouse
            this.mouse = [clientX, clientY];

            var marginLeft = parseFloat($(this).css("marginLeft")) - deltaX * 2;

            marginLeft = Math.min(marginLeft, 0);
            marginLeft = Math.max(marginLeft, -this.parentElement.clientWidth * 2);

            $(this).css("marginLeft", (marginLeft) + "px");
        });

        card.querySelector(".img-tricky").addEventListener("mousemove", function(e){

            if(!this.mouse) {
                this.mouse = [e.clientX, e.clientY];
                return;
            }

            var deltaX = e.clientX - this.mouse[0];

            // update mouse
            this.mouse = [e.clientX, e.clientY];

            var marginLeft = parseFloat($(this).css("marginLeft")) - deltaX * 2;

            marginLeft = Math.min(marginLeft, 0);
            marginLeft = Math.max(marginLeft, -this.parentElement.clientWidth * 2);

            $(this).css("marginLeft", (marginLeft) + "px");
        });

        document.querySelector("#card_box").appendChild(card);
    },

    setFormDOM(e)
    {
        if(!e)
        return;

        var file = e.dataTransfer.files[0];
        tmpEventFile = file;
        var filename = file.name;
        var size = file.size;
        var extension = filename.split(".")[1].toLowerCase();

        if(extension !== "hdre")
            throw("bad extension: not HDRE");

        document.querySelector("#formModalCenter").querySelector("#file-uploaded").innerHTML = filename;
        document.querySelector("#formModalCenter").querySelector("#file-uploaded-size").innerHTML = (size / 1e6).toFixed(2) + " MB";
        document.querySelector("#formModalCenter").querySelector("#hdre-name").value = filename;

        $("#formModalCenter").modal("show");

        $('#formModalCenter').on('shown.bs.modal', function () {
            $('#hdre-name').focus();
        })  

        $('#formModalCenter').on('hide.bs.modal', function () {
           
            $(document.querySelector("#formModalCenter").querySelector("#tags-container")).empty();
        });
    },

    setModalDOM(file, filename, header)
    {
        var modal = document.querySelector("#exampleModalCenter").querySelector(".modal-content");
        modal.innerHTML = `
            <div class="modal-header">
                <h5 class="modal-title" id="exampleModalLongTitle">` + filename + `</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
            <p>Path: ` + file.fullpath + `</p>
            <p>Tags: ` + file.metadata.tags + `</p>
            <p>File size: ` + (file.metadata.size ? file.metadata.size.toFixed(2) : 0.0) + ` MB</p>
            <p>max lum: ` + header.maxLuminance + `
            </div>
            <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
            </div>
        `;
    },

    searchByTag(tag_name)
    {
        var tag = "@" + tag_name;
        document.querySelector("#search-box").value = tag;
        this.showFiles(tag);
    },

    copyFullPath()
    {
        if(last_environment === "no_loaded")
        return;

        var str = FS.root + tmpFiles[last_environment].fullpath;
        LiteGUI.toClipboard(str);
    }
    
}

function getDate(exact_time)
{
    var today = new Date();
    var dd = today.getDate();
    var yy = today.getFullYear();
    var mm = today.getMonth()+1; //January is 0!
    var h = today.getHours();
    var mins = today.getMinutes();

    if(dd<10) dd = '0'+dd
    if(mm<10) mm = '0'+mm
    if(h<10) h = '0'+h
    if(mins<10) mins = '0'+mins

    today = dd+'/'+mm+'/'+ yy + (exact_time ? " - " + h + ':'+mins : "");
    return today;
}

function createPreview( tex_name )
{
    var options = options || {};
	var that = this;
	
	var tex = gl.textures[ tex_name ];

	if( !tex )
        throw("no texture loaded");
        
    var w = tex.width;
    var h = tex.height;

    var nFaces = 3;
    var pixel_data = new Float32Array(w * nFaces * h * 4);
    var row_width = w * nFaces * 4;
    var row_width_single = w * 4;
    var numCols = h;
    var itr = 0;

    var pixels0 = tex.getPixels(1);
    var pixels1 = tex.getPixels(4);
    var pixels2 = tex.getPixels(0);

    var preview = new Texture(w * nFaces, h, {type: GL.FLOAT, format: GL.RGBA, pixel_data: pixel_data});

    var color_step = 1 / (pixel_data.length/4);
    var color = 1;

    for(var j = 0; j < numCols; j++){

        for(var i = 0; i < row_width_single; i+=4)
        {
            var pos = j * row_width + i;
            var posPix = j * row_width_single + i;

            pixel_data[pos++] = pixels0[posPix++];
            pixel_data[pos++] = pixels0[posPix++];
            pixel_data[pos++] = pixels0[posPix++];
            pixel_data[pos++] = pixels0[posPix++];
        }
    }

    for(var j = 0; j < numCols; j++){

        for(var i = row_width_single; i < row_width_single*2; i+=4)
        {
            var pos = j * row_width + i;
            var posPix = (j-1) * row_width_single + i;

            pixel_data[pos++] = pixels1[posPix++];
            pixel_data[pos++] = pixels1[posPix++];
            pixel_data[pos++] = pixels1[posPix++];
            pixel_data[pos++] = pixels1[posPix++];
        }
    }

    for(var j = 0; j < numCols; j++){

        for(var i = row_width_single*2; i < row_width; i+=4)
        {
            var pos = j * row_width + i;
            var posPix = (j-2) * row_width_single + i;

            pixel_data[pos++] = pixels2[posPix++];
            pixel_data[pos++] = pixels2[posPix++];
            pixel_data[pos++] = pixels2[posPix++];
            pixel_data[pos++] = pixels2[posPix++];
        }
    }

	var preview = new Texture(w * nFaces, h, {type: GL.FLOAT, format: GL.RGBA, pixel_data: pixel_data});
	var preview_tm = new Texture(w * nFaces, h, {type: GL.FLOAT, format: GL.RGBA});

	preview_tm.drawTo( function(){
		preview.toViewport( gl.shaders["basicFx"] );
	} );

    var canvas = preview_tm.toCanvas();
	canvas.toBlob(function(e){
		FS.uploadFile( "thb", new File([e], "thb_" + tex_name + ".png"), [] );
	});
}

function openTab(e)
{
    if(!tmpFiles)
    return;

    var url = e.dataset["href"] + "?hdre=" + last_environment;
    var win = window.open(url, '_blank');
    win.focus();
}

function sliderChanged(domEl)
{
    var value = domEl.value;

    if(domEl.id == "exposure-input")
    renderer._uniforms["u_exposure"] = value;

    $(domEl.dataset["target"]).html(value);
}

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