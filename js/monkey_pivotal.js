var MonkeyPivotal = {
	current_tab_url: null,
	bg_page: null,
	doc_key: null,
	gdoc: null,
	global_counter: 0,
	gmatches: [],
	
	pivotal_regex_g: /https:\/\/www.pivotaltracker.com\/story\/show\/([\d]+)([\s]?)(\([\w\s]+\))?/gi,
	pivotal_regex: /https:\/\/www.pivotaltracker.com\/story\/show\/([\d]+)([\s]?)(\([\w\s]+\))?/i,
	
	init: function(){
		this.bg_page = chrome.extension.getBackgroundPage();
		this.auth_check();
		this.bind_elements();
		this.init_analyze_document();
	},
	
	auth_check: function(){
		this.bg_page.oauth.authorize(function() {
		  MonkeyPivotal.schedule_request();
		});
	},
	
	bind_elements: function(){
		$('#begin_analyze').click(function(event){
			MonkeyPivotal.begin_analyze();
		});
		$('#start_update').click(function(event){
			MonkeyPivotal.start_update_document();
		});
	},
	
	init_analyze_document: function(){
		chrome.tabs.getSelected(null,function(tab) {
		    MonkeyPivotal.current_tab_url = tab.url;
		});
	},
	
	schedule_request: function() {
		if (this.bg_page.oauth.hasToken()) {
			$('#monkey_box').show();
		} else {
			this.show_message('Please, authorize app.');
		}
	},
	
	begin_analyze: function(){
		if (this.current_tab_url != null){
			var regex_pattern = /^(http|https):\/\/([\w\.\/]+)\/document\/d\/([\w\.\-\_]+)\/(.*)/i;
			if (regex_pattern.test(this.current_tab_url)){
				var found_str = this.current_tab_url.match(regex_pattern);
				if (found_str[3]){
					this.doc_key = found_str[3];
					this.download_gdocument(this.doc_key);
				} else {
					this.show_message('Please, go to google document');
				}
			} else {
				this.show_message('Please, go to google document');
			}
		} else {
			this.show_message('Please, go to google document');
		}
	},
	
	download_gdocument: function(key){
		var url = 'https://docs.google.com/feeds/download/documents/export/Export?id=' + key;
		$.get(url, function(data){ 
			MonkeyPivotal.handle_dowload_success(data);
		});
	},
	
	handle_dowload_success: function(response){
		this.gdoc = response;
		var count_links = this.gdoc.match(this.pivotal_regex_g).length;
		if (count_links > 0){
			this.show_message('Found ' + count_links + ' link(s).');
			this.show_start_button();
		} else {
			this.show_message('Document doesn\'t have pivotal links.');
		}
	},
	
	show_start_button: function(){
		$('#start_update').show();
	},
	
	start_update_document: function(){
		if (this.gdoc != null){
			this.gmatches = this.gdoc.match(this.pivotal_regex_g);
			this.global_counter = 0;
			this.update_local_doc();
		} else {
			this.show_message('Analyze doc before.');
		}
	},
	
	update_local_doc: function(){
		if (this.gmatches[this.global_counter]){
			var temp_match = this.gmatches[this.global_counter];
			var pivotal_ids = temp_match.match(this.pivotal_regex);
			$.getJSON('http://monkey.railsware.com/pivotal_story_status/' + pivotal_ids[1] + '.json', function(data) {
				if (data.story_status != 'unknown'){
					var r = new RegExp("https:\\/\\/www.pivotaltracker.com\\/story\\/show\\/" + pivotal_ids[1] + "([\\s]?)(\\([\\w\\s]+\\))?", "gi");
					MonkeyPivotal.gdoc = MonkeyPivotal.gdoc.replace(r, 'https://www.pivotaltracker.com/story/show/' + pivotal_ids[1] + ' (' + data.story_status + ')');
				}
				MonkeyPivotal.global_counter++;
				MonkeyPivotal.update_local_doc();
			});
		} else {
			this.show_message("Done. Updating doc.");
			this.update_gdocument();
		}
	},
	
	update_gdocument: function(){
		var params = {
	    'method': 'PUT',
	    'headers': {
	      'GData-Version': '3.0',
	      'Content-Type': 'multipart/related; boundary=END_OF_PART',
	      'If-Match': '*'
	    },
			'parameters': {'alt': 'json'},
	    'body': this.construct_content_body()
	  };

	  var url = this.bg_page.DOCLIST_FEED + this.doc_key;
	  this.bg_page.oauth.sendSignedRequest(url, this.handle_upload_success, params);
	},
	
	handle_upload_success: function(response){
		this.show_message(response);
	},
	
	construct_content_body: function(){
		var body = ['--END_OF_PART\r\n',
	              'Content-Type: application/atom+xml;\r\n\r\n',
	              this.construct_header_body(), '\r\n',
	              '--END_OF_PART\r\n',
	              'Content-Type: text/html\r\n\r\n',
	              this.gdoc, '\r\n',
	              '--END_OF_PART--\r\n'].join('');
	  return body;
	},
	
	construct_header_body: function(){
		var starCat = ['<category scheme="http://schemas.google.com/g/2005/labels" ',
	                 'term="http://schemas.google.com/g/2005/labels#starred" ',
	                 'label="starred"/>'].join('');

	  var atom = ["<?xml version='1.0' encoding='UTF-8'?>", 
	              '<entry xmlns="http://www.w3.org/2005/Atom">',
	              '<category scheme="http://schemas.google.com/g/2005#kind"', 
	              ' term="http://schemas.google.com/docs/2007#document"/>',
	              '',
	              '</entry>'].join('');
	  return atom;
	},
	
	show_message: function(msg){
		$('#messages').html(msg);
	}
	
};


$(function() {
	MonkeyPivotal.init();
});

