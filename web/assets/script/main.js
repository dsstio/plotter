"use strict"

$(function () {

	$('#btnprintsmall').click(function () {
		send($(this), {msg:$('#text').val(), action:'printsmall'})
	})
	$('#btnprintbig').click(function () {
		send($(this), {msg:$('#text').val(), action:'printbig'})
	})
	$('#btnprintqrcode').click(function () {
		send($(this), {msg:$('#text').val(), action:'printqrcode'})
	})
	$('.image').click(function () {
		var $node = $(this);
		send($node.find('img'), {msg:$node.attr('name'), action:'printimage'})
	})
	
	function send($node, data) {
		$node.addClass('loading');
		$.post({
			url:'/api',
			data:data,
			success: function (response) {
				if (response === false) {
					$node.removeClass('loading');
					addMessage($node, 'success');
				} else {
					$node.removeClass('loading');
					addMessage($node, 'error');
					$('#error-message').text(response);
					$('#error-modal').modal('show');
				}
			},
			error: function () {
				$node.removeClass('loading');
				addMessage($node, 'error');
			}
		})
	}

	function addMessage($node, type) {
		var $mark;
		if (type === 'success') {
			$mark = '<div class="mark success"><i class="fa fa-check" aria-hidden="true"></i></div>';
		} else {
			$mark = '<div class="mark error"><i class="fa fa-exclamation" aria-hidden="true"></i></div>';
		}
		$mark = $($mark);
		$('body').append($mark);

		var position = $node.offset();
		position.left += $node.outerWidth()-16;
		position.top  += -16;
		$mark.css(position);

		$mark
			.delay(1000)
			.fadeOut(200, function () { $mark.remove() });
	}
})
