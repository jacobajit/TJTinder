<?php
	require 'vendor/autoload.php';

	use Firebase\Token\TokenException;
	use Firebase\Token\TokenGenerator;

	try {
	    $generator = new TokenGenerator('3u8lBgQGl8xGVldaXx4iI7hE3p5pbn7N22ifdKMH');
	    $token = $generator
	        ->setData(array('uid' => '32215'))
	        ->create();
	} catch (TokenException $e) {
	    echo "Error: ".$e->getMessage();
	}

	echo $token;
?>