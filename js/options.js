var MonkeyPivotalOptions = {
	bg_page: null,	

	init: function(){
		this.bg_page = chrome.extension.getBackgroundPage();
		if (!this.bg_page.oauth.hasToken()) {
          		$('#revoke').get(0).disabled = true;
        	}

		var is_notification = localStorage.is_show_notifications || 1;
		
        	if (1 == is_notification) {
          		$('#show_notification').attr("checked", "checked");
        	} else {
           		$('#show_notification').removeAttr('checked');
        	}

		$('#revoke').click(function(){
			MonkeyPivotalOptions.bg_page.logout();
        		$('#revoke').get(0).disabled = true;
		});
		
		$('#show_notification').click(function() {
			if ($("#show_notification").is(':checked')){
				localStorage.is_show_notifications = 1;
			} else {
				localStorage.is_show_notifications = 0;
			}
		});
		
		$('#pivotal_token').change(function(){
		  localStorage.pivotal_token = $(this).val();
		});
		$('#pivotal_token').val(localStorage.pivotal_token);
		
	},
	

};

$(function() {
	MonkeyPivotalOptions.init();
});
