/*
*   Alex Rodriguez
*   @jxarco 
*/

// TextureWebcam at webglstudio.org graph system (@jagenjo)

function TextureWebcam() {

    this.node = node;
	this.mark = true;
	this.collapsed = false;
    this.nodeComponent = true;
    
    this.enabled = true;
    this.texture_name = "@webcam_stream";
}

TextureWebcam.is_webcam_open = false;
TextureWebcam.icon = "https://webglstudio.org/latest/imgs/mini-icon-knob.png";

Object.assign( TextureWebcam.prototype, {

	setup() {
		
		console.log(RM);

		this.node.old_shader = this.node.shader;

        //this.node.shader = "webcam";
        //this.node.texture = this.texture_name;

		Object.assign(this.node.uniforms, {});
	},

	create(widgets, root) {
		
		var that = this;

		widgets.addSection("Webcam", {collapsed: that.collapsed, callback: function(no_collapsed){
				that.collapsed = !no_collapsed;
			}});
	

		widgets.addCheckbox("Enabled", this.enabled, { callback: function(v){ 
            that.enabled = v; 
            
            if(v && !TextureWebcam.is_webcam_open)
                that.openStream();
            else if(!v)
                that.closeStream();
		} });
		
	}
});

TextureWebcam.prototype.openStream = function() {
  
    if (!navigator.getUserMedia) {
        //console.log('getUserMedia() is not supported in your browser, use chrome and enable WebRTC from about://flags');
        return;
    }

    this._waiting_confirmation = true;

    // Not showing vendor prefixes.
    var constraints = {
        audio: false,
        video: { facingMode: 'user' }
    };
    navigator.mediaDevices
        .getUserMedia(constraints)
        .then(this.streamReady.bind(this))
        .catch(onFailSoHard);

    var that = this;
    function onFailSoHard(e) {
        TextureWebcam.is_webcam_open = false;
        console.log("Webcam rejected", e);
        that._webcam_stream = false;
    }
};

TextureWebcam.prototype.closeStream = function() {
    if (this._webcam_stream) {
        var tracks = this._webcam_stream.getTracks();
        if (tracks.length) {
            for (var i = 0; i < tracks.length; ++i) {
                tracks[i].stop();
            }
        }
        TextureWebcam.is_webcam_open = false;
        this._webcam_stream = null;
        this._video = null;
    }
};

TextureWebcam.prototype.streamReady = function(localMediaStream) {
    this._webcam_stream = localMediaStream;
    //this._waiting_confirmation = false;
    var video = this._video;
    if (!video) {
        video = document.createElement("video");
        video.autoplay = true;
        video.srcObject = localMediaStream;
        this._video = video;
        //document.body.appendChild( video ); //debug
        //when video info is loaded (size and so)
        video.onloadedmetadata = function(e) {
            // Ready to go. Do some stuff.
            TextureWebcam.is_webcam_open = true;
            console.log(e);
        };
    }
};

TextureWebcam.prototype.onRemoved = function() {
    if (!this._webcam_stream) {
        return;
    }

    var tracks = this._webcam_stream.getTracks();
    if (tracks.length) {
        for (var i = 0; i < tracks.length; ++i) {
            tracks[i].stop();
        }
    }

    this._webcam_stream = null;
    this._video = null;
};

TextureWebcam.prototype.preRender = function() {
    if (this._webcam_stream == null && !this._waiting_confirmation) {
        this.openStream();
    }

    if (!this._video || !this._video.videoWidth) {
        return;
    }

    var width = this._video.videoWidth;
    var height = this._video.videoHeight;

    var temp = this._video_texture;
    if (!temp || temp.width != width || temp.height != height) {
        this._video_texture = new GL.Texture(width, height, {
            format: gl.RGB,
            filter: gl.LINEAR
        });
    }

    this._video_texture.uploadImage(this._video);
    this._video_texture.version = ++this.version;

    if (this.texture_name) {
        gl.textures[this.texture_name] = this._video_texture;
    }
};

RM.registerNodeComponent( TextureWebcam, 'Webcam');