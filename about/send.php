<?php
$message = $_POST['Message'];
$email   = $_POST['mailfrom'];

mail("ms@thecontrarian.in","Email from $email",$message);

echo "MESSAGE SENT! <br><br> A reply will be sent to $email <br><br> Now go take a look some of <a href='http://thecontrarian.in/photography/'>my projects</a> or read <a href='http://thecontrarian.in/about/'>about me</a>.";
?>
