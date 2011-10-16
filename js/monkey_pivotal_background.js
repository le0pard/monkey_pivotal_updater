var MonkeyPivotalBackground = {
	is_started: false,
	doc_key: null,
	gdoc: null,
	global_counter: 0,
	gmatches: [],

  /* 256 KB */
  MAX_DOC_LENGTH: 262144,
  RESUMABLE_CHUNK: 262144,
  resumable_url: null,
  resumable_length: 0,

	pivotal_regex: /https:\/\/www.pivotaltracker.com\/story\/show\/([\d]+)/i,
	
	update_message_on_popup: function(msg){
		chrome.extension.sendRequest({loading_message: msg}, function(response) {
			//console.log(response.loading_message);
		});
	},

	update_icon_counter: function(){
		var res_data = this.gmatches.length - this.global_counter;
		chrome.browserAction.setBadgeText({'text': res_data.toString()});
	},

	show_notice_message_on_popup: function(msg){
		chrome.extension.sendRequest({notice_message: msg}, function(response) {
			//console.log(response.notice_message);
		});
	},

  show_error_message_on_popup: function(msg){
		chrome.extension.sendRequest({error_message: msg}, function(response) {
			//console.log(response.notice_message);
		});
	},

	hide_popup_buttons: function(){
		chrome.extension.sendRequest({hide_popup_buttons: true}, function(response) {
			//console.log(response.notice_message);
		});
	},

	update_doc_iteration: function(is_new){
		MonkeyPivotalBackground.is_started = true;
		if (this.gmatches[this.global_counter]){
		  this.update_icon_counter();
			this.update_message_on_popup('Processing links. Done ' + this.global_counter + ' from ' + this.gmatches.length);
			var temp_match = this.gmatches[this.global_counter];
			var pivotal_ids = temp_match.match(this.pivotal_regex);
			$.getJSON('http://monkey.railsware.com/pivotal_story_status/' + pivotal_ids[1] + '.json', function(data) {
				var r = new RegExp("https:\\/\\/www.pivotaltracker.com\\/story\\/show\\/" + pivotal_ids[1] + "([\\s]?)(\\([\\w\\-\\:\\s]+\\))?", "gi");
				var link_info = data.story_status;
				if (data.deadline){
				  link_info = data.deadline; 
			  }
			  MonkeyPivotalBackground.gdoc = MonkeyPivotalBackground.gdoc.replace(r, 'https://www.pivotaltracker.com/story/show/' + pivotal_ids[1] + ' (' + link_info + ')');
				var r_restore = new RegExp("(href=\")https:\\/\\/www.pivotaltracker.com\\/story\\/show\\/" + pivotal_ids[1] + "([\\s]?)(\\([\\w\\-\\:\\s]+\\))?", "gi");
				MonkeyPivotalBackground.gdoc = MonkeyPivotalBackground.gdoc.replace(r_restore, 'href="https://www.pivotaltracker.com/story/show/' + pivotal_ids[1]);
				MonkeyPivotalBackground.global_counter++;
				MonkeyPivotalBackground.update_doc_iteration(is_new);
			});
		} else {
		  chrome.browserAction.setBadgeText({'text': "..."});
			if (is_new){
				this.update_message_on_popup("Creating new document...");
				if (MonkeyPivotalBackground.gdoc.length >= MonkeyPivotalBackground.MAX_DOC_LENGTH){
				  this.create_resumable_gdocument();
				} else {
          this.create_gdocument();
				}
			} else {
				this.update_message_on_popup("Updating document...");
        if (MonkeyPivotalBackground.gdoc.length >= MonkeyPivotalBackground.MAX_DOC_LENGTH){
				  this.update_resumable_gdocument();
				} else {
          this.update_gdocument();
				}
			}
		}
	},

	create_gdocument: function(){
		var params = {
	    	'method': 'POST',
	    	'headers': {
	      		'GData-Version': '3.0',
	      		'Content-Type': 'multipart/related; boundary=END_OF_PART',
			      'Slug': 'Monkey Patch'
	    	},
		    'parameters': {'alt': 'json'},
	    	'body': this.construct_new_content_body('monkey_' + new Date().getTime())
	  	};

	  	var url = DOCLIST_FEED;
	  	oauth.sendSignedRequest(url, MonkeyPivotalBackground.handle_upload_success, params);
	},
	
	update_gdocument: function(){
		var etag = 'MsgA' + new Date().getTime();
		var params = {
	    	'method': 'PUT',
	    	'headers': {
	      		'GData-Version': '3.0',
	      		'Content-Type': 'multipart/related; boundary=END_OF_PART',
	      		'If-Match': '*',
			      'Slug': 'Monkey Patch'
	    	},
		    'parameters': {'alt': 'json'},
	    	'body': this.construct_update_content_body(etag)
	  	};

	  	var url = DOCLIST_FEED + this.doc_key;
	  	oauth.sendSignedRequest(url, MonkeyPivotalBackground.handle_upload_success, params);
	},
	
	handle_upload_success: function(response, xhr){
		var data = null;
		var msg = 'Done. Thanks for all :)';
		var n_msg = msg;
		var is_show_notifications = localStorage.is_show_notifications || 1;
		
		try {
			data = JSON.parse(response);
		} catch(err) {
			data = null;
		}
		if (data == null){
			msg = 'Done. Thanks for all :) For debug: ' + response;
		} else if (data.entry && data.entry.title && data.entry.link && MonkeyPivotalBackground.get_gdoc_link(data.entry.link, 'alternate') != null) {
			msg = 'All done. <a href="'+ MonkeyPivotalBackground.get_gdoc_link(data.entry.link, 'alternate').href +'" target="_blank">' + data.entry.title.$t + '</a>';
			if (is_show_notifications){
				n_msg = 'All done. Name: ' +  data.entry.title.$t + ', Link: ' + MonkeyPivotalBackground.get_gdoc_link(data.entry.link, 'alternate').href;
			}
		} else {
			msg = 'Done. Thanks for all :) For debug: ' + response;
		}
		MonkeyPivotalBackground.show_notice_message_on_popup(msg);
		if (1 == is_show_notifications){
			MonkeyPivotalBackground.show_notification('Work done!', n_msg);
		}
		MonkeyPivotalBackground.clear_variables();
	},
	
	clear_variables: function(){
	  chrome.browserAction.setBadgeText({'text': ""});
		/* clear variables */
		MonkeyPivotalBackground.global_counter = 0;
		MonkeyPivotalBackground.gmatches = [];
		MonkeyPivotalBackground.doc_key = null;
		MonkeyPivotalBackground.gdoc = null;
		MonkeyPivotalBackground.resumable_length = 0;
		MonkeyPivotalBackground.resumable_url = null;
		MonkeyPivotalBackground.is_started = false;
	},

	get_gdoc_link: function(links, rel){
		for (var i = 0, link; link = links[i]; ++i) {
    			if (link.rel === rel) {
      				return link;
    			}
  		}
  		return null;
	},

	show_notification: function(title, msg){
		var notification = webkitNotifications.createNotification(
      			'img/icon48.png',
      			title,
      			msg
    		);
    		notification.show();
	},

	construct_update_content_body: function(etag){
		var body = ['--END_OF_PART\r\n',
	              'Content-Type: application/atom+xml;\r\n\r\n',
	              this.construct_update_header_body(etag), '\r\n',
	              '--END_OF_PART\r\n',
	              'Content-Type: text/html\r\n\r\n',
	              this.gdoc, '\r\n',
	              '--END_OF_PART--\r\n'].join('');
	  return body;
	},

	construct_update_header_body: function(etag){
		var atom = ["<?xml version='1.0' encoding='UTF-8'?>", 
	              '<entry xmlns="http://www.w3.org/2005/Atom"', 
		      ' xmlns:gd="http://schemas.google.com/g/2005"',
		      ' gd:etag="', etag, '">',
	              '<category scheme="http://schemas.google.com/g/2005#kind"', 
	              ' term="http://schemas.google.com/docs/2007#document"/>',
	              '',
	              '</entry>'].join('');
	  return atom;
	},
	
	construct_new_content_body: function(title){
		var body = ['--END_OF_PART\r\n',
	              'Content-Type: application/atom+xml;\r\n\r\n',
	              this.construct_new_header_body(title), '\r\n',
	              '--END_OF_PART\r\n',
	              'Content-Type: text/html\r\n\r\n',
	              this.gdoc, '\r\n',
	              '--END_OF_PART--\r\n'].join('');
	  return body;
	},
	
	construct_new_header_body: function(title){
		var doc_title = title || null;

	  var atom = ["<?xml version='1.0' encoding='UTF-8'?>", 
	              '<entry xmlns="http://www.w3.org/2005/Atom">',
	              '<category scheme="http://schemas.google.com/g/2005#kind"', 
	              ' term="http://schemas.google.com/docs/2007#document"/>',
	              doc_title ? '<title>' + doc_title + '</title>' : '',
	              '</entry>'].join('');
	  return atom;
	},


  /* resumable protocol */
  create_resumable_gdocument: function(){
    var params = {
	    	'method': 'POST',
	    	'headers': {
	      		'GData-Version': '3.0',
	      		'Content-Type': 'text/html',
			      'Slug': ('monkey_' + new Date().getTime()),
            'X-Upload-Content-Type': 'text/html',
            'X-Upload-Content-Length': this.gdoc.length
	    	},
		    'parameters': {'alt': 'json'}
	  	};

	  	var url = DOCLIST_SCOPE + '/upload/create-session/default/private/full';
	  	oauth.sendSignedRequest(url, MonkeyPivotalBackground.handle_resumable_gdocument, params);
  },
  
  update_resumable_gdocument: function(){
		var params = {
	    	'method': 'PUT',
	    	'headers': {
	      		'GData-Version': '3.0',
	      		'Content-Type': 'text/html',
	      		'If-Match': '*',
			      'Slug': 'Monkey Patch',
			      'X-Upload-Content-Type': 'text/html',
            'X-Upload-Content-Length': this.gdoc.length
	    	},
		    'parameters': {'alt': 'json'}
	  	};

	  	var url = DOCLIST_SCOPE + '/upload/create-session/default/private/full/' + this.doc_key;
	  	oauth.sendSignedRequest(url, MonkeyPivotalBackground.handle_resumable_gdocument, params);
  },
  
  handle_resumable_gdocument: function(response, xhr){
    if (4 == xhr.readyState && 200 == xhr.status){
      if (xhr.getResponseHeader('location')){
        MonkeyPivotalBackground.resumable_url = xhr.getResponseHeader('location');
        MonkeyPivotalBackground.update_message_on_popup("Creating doc: 0/" + MonkeyPivotalBackground.gdoc.length);
        MonkeyPivotalBackground.upload_resumable_document();
      } else {
        MonkeyPivotalBackground.show_error_message_on_popup('Error creating document. Sorry :(');
        MonkeyPivotalBackground.clear_variables();
      }
    } else {
      MonkeyPivotalBackground.show_error_message_on_popup('Error creating document. Sorry :(');
      MonkeyPivotalBackground.clear_variables();
    }
  },

  upload_resumable_document: function(){
    var init_data_length = MonkeyPivotalBackground.resumable_length;
    var last_data_length = MonkeyPivotalBackground.resumable_length + MonkeyPivotalBackground.RESUMABLE_CHUNK;
    if (last_data_length > this.gdoc.length){
      last_data_length = this.gdoc.length;
    }

    MonkeyPivotalBackground.resumable_length = last_data_length;
    
    MonkeyPivotalBackground.update_message_on_popup("Uploading doc: " + last_data_length + "/" + MonkeyPivotalBackground.gdoc.length);
    
    $.ajax({
      type: 'PUT',
      url: MonkeyPivotalBackground.resumable_url,
      data: MonkeyPivotalBackground.gdoc.substring(init_data_length, last_data_length),
      contentType: 'text/html',
      headers: {
        'GData-Version': '3.0',
    		'Content-Type': 'text/html',
        'Content-Range': 'bytes ' + init_data_length + '-' + (last_data_length - 1) + '/' + MonkeyPivotalBackground.gdoc.length
      },
      complete: function(jqXHR, textStatus){
        MonkeyPivotalBackground.handle_upload_resumable_document(jqXHR.responseText, jqXHR);
      }
    });
  },

  handle_upload_resumable_document: function(response, xhr){
    if (308 == xhr.status && 4 == xhr.readyState){
      if (MonkeyPivotalBackground.resumable_length < MonkeyPivotalBackground.gdoc.length){
        if (xhr.getResponseHeader('location')){
          MonkeyPivotalBackground.resumable_url = xhr.getResponseHeader('location');
        }
        MonkeyPivotalBackground.upload_resumable_document();
      } else {
        MonkeyPivotalBackground.handle_upload_success(response, xhr);
      }
    } else if (200 == xhr.status || 201 == xhr.status || 400 == xhr.status){
      MonkeyPivotalBackground.handle_upload_success(response, xhr);
    } else {
      MonkeyPivotalBackground.show_error_message_on_popup('Error creating document. Sorry :(');
      MonkeyPivotalBackground.clear_variables();
    }
  }
  
  
};


