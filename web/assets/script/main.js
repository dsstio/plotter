"use strict"

$(function () {

	$('#btnprintsmall').click(function () {
		send('#btnprintsmall', {msg:$('#text').val(), action:'printsmall'})
	})
	$('#btnprintbig').click(function () {
		send('#btnprintbig', {msg:$('#text').val(), action:'printbig'})
	})
	$('#btnprintqrcode').click(function () {
		send('#btnprintqrcode', {msg:$('#text').val(), action:'printqrcode'})
	})
	
	function send(id, data) {
		$(id).addClass('loading');
		$.post({
			url:'/api',
			data:data,
			success: function () {
				$(id).removeClass('loading').addClass('btn-success');
				setTimeout(function () { $(id).removeClass('btn-success') }, 500)
			},
			error: function () {
				$(id).removeClass('loading').addClass('btn-danger');
				setTimeout(function () { $(id).removeClass('btn-danger') }, 500)
			}
		})
	}
})
