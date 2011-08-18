var MonkeyPivotal = {
	bg_page: null,
	doc_key: null,
	gdoc: null,
	global_counter: 0,
	gmatches: [],
	
	pivotal_regex_g: /https:\/\/www.pivotaltracker.com\/story\/show\/([\d]+)/gi,
	pivotal_regex: /https:\/\/www.pivotaltracker.com\/story\/show\/([\d]+)/i,
	
	init: function(){
		this.bg_page = chrome.extension.getBackgroundPage();
		this.bind_elements();
		this.auth_check();		
	},
	
	auth_check: function(){
		this.bg_page.oauth.authorize(function() {
		  MonkeyPivotal.init_analyze_document();
		});
	},
	
	bind_elements: function(){
		$('#start_update_current').click(function(event){
			MonkeyPivotal.start_update_document(false);
		});
		$('#start_update_new').click(function(event){
			MonkeyPivotal.start_update_document(true);
		});
	},
	
	init_analyze_document: function(){
		chrome.windows.getCurrent(function(w) {
			chrome.tabs.getSelected(w.id, function(tab){	
				MonkeyPivotal.begin_analyze(tab.url);
			});
		});
	},
	
	begin_analyze: function(current_tab_url){
		if (current_tab_url != null){
			var regex_pattern = /^(http|https):\/\/([\w\.\/]+)\/document\/d\/([\w\.\-\_]+)\/(.*)/i;
			if (regex_pattern.test(current_tab_url)){
				var found_str = current_tab_url.match(regex_pattern);
				if (found_str[3]){
					this.doc_key = found_str[3];
					this.download_gdocument(this.doc_key);
				} else {
					this.show_message('Please, open google document', 'notice');
				}
			} else {
				this.show_message('Please, open google document', 'notice');
			}
		} else {
			this.show_message('Please, open google document', 'notice');
		}
	},
	
	download_gdocument: function(key){
		this.loading_message('Loading document...');
		var url = 'https://docs.google.com/feeds/download/documents/export/Export?id=' + key;
		$.get(url, function(data){ 
			MonkeyPivotal.handle_dowload_success(data);
		});
	},
	
	handle_dowload_success: function(response){
		this.gdoc = response;
		this.gmatches = this.unique_array(this.gdoc.match(this.pivotal_regex_g));
		if (this.gmatches.length > 0){
			this.show_message('Found ' + this.gmatches.length + ' link(s).', 'notice');
			this.show_buttons();
		} else {
			this.show_message('Document doesn\'t contain pivotal links :(', 'warning');
		}
	},

	unique_array: function(array){
		var dupes = {}; 
		var len, i;
		for (i=0,len=array.length; i<len; i++){
			var test = array[i].toString();
			if (dupes[test]) { 
				array.splice(i,1); 
				len--; 
				i--; 
			} else { 
				dupes[test] = true; 
			}
		}
		return array;
	},
	
	show_buttons: function(){
		$('#control_buttons_box').show();
	},
	
	hide_buttons: function(){
		$('#control_buttons_box').hide();
	},
	
	start_update_document: function(in_new){
		if (this.gdoc != null && this.gmatches.length > 0){
			this.loading_message('Processing links...');
			this.global_counter = 0;
			this.update_local_doc(in_new);
		} else {
		        this.show_message('Document doesn\'t contain pivotal links :(', 'warning');
		}
	},
	
	update_local_doc: function(is_new){
		if (this.gmatches[this.global_counter]){
			this.update_loading_message('Processing links. Done ' + this.global_counter + ' from ' + this.gmatches.length);
			var temp_match = this.gmatches[this.global_counter];
			var pivotal_ids = temp_match.match(this.pivotal_regex);
			$.getJSON('http://monkey.railsware.com/pivotal_story_status/' + pivotal_ids[1] + '.json', function(data) {
				var r = new RegExp("https:\\/\\/www.pivotaltracker.com\\/story\\/show\\/" + pivotal_ids[1] + "([\\s]?)(\\([\\w\\s]+\\))?", "gi");
				MonkeyPivotal.gdoc = MonkeyPivotal.gdoc.replace(r, 'https://www.pivotaltracker.com/story/show/' + pivotal_ids[1] + ' (' + data.story_status + ')');
				var r_restore = new RegExp("(href=\")https:\\/\\/www.pivotaltracker.com\\/story\\/show\\/" + pivotal_ids[1] + "([\\s]?)(\\([\\w\\s]+\\))?", "gi");
				MonkeyPivotal.gdoc = MonkeyPivotal.gdoc.replace(r_restore, 'href="https://www.pivotaltracker.com/story/show/' + pivotal_ids[1]);
				MonkeyPivotal.global_counter++;
				MonkeyPivotal.update_local_doc(is_new);
			});
		} else {
			if (is_new){
				this.update_loading_message("Creating new document...", 'notice');
				this.create_gdocument();
			} else {
				this.update_loading_message("Updating document...", 'notice');
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

	  	var url = this.bg_page.DOCLIST_FEED;
	  	this.bg_page.oauth.sendSignedRequest(url, MonkeyPivotal.handle_upload_success, params);
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

	  	var url = this.bg_page.DOCLIST_FEED + this.doc_key;
	  	this.bg_page.oauth.sendSignedRequest(url, MonkeyPivotal.handle_upload_success, params);
	},
	
	handle_upload_success: function(response, xhr){
		var data = null;
		try {
			data = JSON.parse(response);
		} catch(err) {
			data = null;
		}
		if (data == null){
			MonkeyPivotal.show_message('Done. Thanks for all :)', 'notice');
		} else if (data.entry && data.entry.title && data.entry.link && MonkeyPivotal.get_gdoc_link(data.entry.link, 'alternate') != null) {
			MonkeyPivotal.show_message('New document created. <a href="'+ MonkeyPivotal.get_gdoc_link(data.entry.link, 'alternate').href +'" target="_blank">' + data.entry.title.$t + '</a>', 'notice');
		} else {
			MonkeyPivotal.show_message('Done. Thanks for all :)', 'notice');
		}
		MonkeyPivotal.hide_buttons();
	},

	get_gdoc_link: function(links, rel){
		for (var i = 0, link; link = links[i]; ++i) {
    			if (link.rel === rel) {
      				return link;
    			}
  		}
  		return null;
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
	
	show_message: function(msg, msg_type){
		$('#flash_messages .msg').html(msg);
		$('#flash_messages .message').removeClass('error warning notice loading').addClass(msg_type);
		$('#flash_messages').show();
	},

	hide_message: function(){
		$('#flash_messages').hide();
	},
        
        loading_message: function(msg){
		this.hide_message();
		$('#flash_messages .msg').html(msg);
		$('#flash_messages .message').removeClass('error warning notice').addClass('loading');
		$('#flash_messages').show();
		
	},
	update_loading_message: function(msg){
		$('#flash_messages .msg').html(msg);
	}
	
};


$(function() {
	MonkeyPivotal.init();
});

