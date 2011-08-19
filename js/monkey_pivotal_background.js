var MonkeyPivotalBackground = {
	is_started: false,
	doc_key: null,
	gdoc: null,
	global_counter: 0,
	gmatches: [],

	pivotal_regex: /https:\/\/www.pivotaltracker.com\/story\/show\/([\d]+)/i,
	
	update_message_on_popup: function(msg){
		console.log(msg);
		chrome.extension.sendRequest({loading_message: msg}, function(response) {
			//console.log(response.loading_message);
		});
		this.update_icon_counter();
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

	hide_popup_buttons: function(){
		chrome.extension.sendRequest({hide_popup_buttons: true}, function(response) {
			//console.log(response.notice_message);
		});
	},

	update_local_doc: function(is_new){
		MonkeyPivotalBackground.is_started = true;
		if (this.gmatches[this.global_counter]){
			this.update_message_on_popup('Processing links. Done ' + this.global_counter + ' from ' + this.gmatches.length);
			var temp_match = this.gmatches[this.global_counter];
			var pivotal_ids = temp_match.match(this.pivotal_regex);
			$.getJSON('http://monkey.railsware.com/pivotal_story_status/' + pivotal_ids[1] + '.json', function(data) {
				var r = new RegExp("https:\\/\\/www.pivotaltracker.com\\/story\\/show\\/" + pivotal_ids[1] + "([\\s]?)(\\([\\w\\s]+\\))?", "gi");
				MonkeyPivotalBackground.gdoc = MonkeyPivotalBackground.gdoc.replace(r, 'https://www.pivotaltracker.com/story/show/' + pivotal_ids[1] + ' (' + data.story_status + ')');
				var r_restore = new RegExp("(href=\")https:\\/\\/www.pivotaltracker.com\\/story\\/show\\/" + pivotal_ids[1] + "([\\s]?)(\\([\\w\\s]+\\))?", "gi");
				MonkeyPivotalBackground.gdoc = MonkeyPivotalBackground.gdoc.replace(r_restore, 'href="https://www.pivotaltracker.com/story/show/' + pivotal_ids[1]);
				MonkeyPivotalBackground.global_counter++;
				MonkeyPivotalBackground.update_local_doc(is_new);
			});
		} else {
			if (is_new){
				this.update_message_on_popup("Creating new document...", 'notice');
				this.create_gdocument();
			} else {
				this.update_message_on_popup("Updating document...", 'notice');
				this.update_gdocument();
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
		var is_show_notifications = localStorage.is_show_notifications;
		
		try {
			data = JSON.parse(response);
		} catch(err) {
			data = null;
		}
		if (data == null){
			msg = 'Done. Thanks for all :)';
		} else if (data.entry && data.entry.title && data.entry.link && MonkeyPivotalBackground.get_gdoc_link(data.entry.link, 'alternate') != null) {
			msg = 'All done. <a href="'+ MonkeyPivotalBackground.get_gdoc_link(data.entry.link, 'alternate').href +'" target="_blank">' + data.entry.title.$t + '</a>';
			if (is_show_notifications){
				n_msg = 'All done. Name: ' +  data.entry.title.$t + ', Link: ' + MonkeyPivotalBackground.get_gdoc_link(data.entry.link, 'alternate').href;
			}
		} else {
			msg = 'Done. Thanks for all :)';
		}
		MonkeyPivotalBackground.show_notice_message_on_popup(msg);
		if (is_show_notifications == 'true'){
			MonkeyPivotalBackground.show_notification(n_msg);
		}
		chrome.browserAction.setBadgeText({'text': ""});
		/* clear variables */
		MonkeyPivotalBackground.global_counter = 0;
		MonkeyPivotalBackground.gmatches = [];
		MonkeyPivotalBackground.doc_key = null;
		MonkeyPivotalBackground.gdoc = null;
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

	show_notification: function(msg){
		var notification = webkitNotifications.createNotification(
      			'img/icon48.png',
      			'Work done!',
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
	}
};


