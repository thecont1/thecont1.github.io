<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<HTML>
<HEAD>
<TITLE>About Mahesh Shantaram, Art-Documentary photographer based in Bangalore, India</TITLE>
<META name="author" content="Mahesh Shantaram">
<META name="description" content="">

<meta property="og:title" content="About Mahesh Shantaram" />
<meta property="og:url" content="http://thecontrarian.in/about/" />
<meta property="og:image" content="http://thecontrarian.in/photography/matrimania/images/24.jpg" />
<meta property="og:description" content="Mahesh Shantaram is an independent art-documentary photographer based in Bangalore, India.">

<link href="http://fonts.googleapis.com/css?family=Lato" rel="stylesheet" type="text/css">
<LINK REL=stylesheet HREF="/photography/style.css" TYPE='text/css'>
<STYLE>
DIV.text {
	font: 8pt Verdana, Arial, sanserif; 
	line-height: 1.7em;
	background-color: none;
	color: #000000; 
	POSITION: absolute;
	top: 40px;
	left: 200px;
	width: 400px;
	padding-top: 5px;
}

DIV.pics {
	position: absolute;
	top: 0px;
	left: 450px;
	width: 300px;
	line-height: 1.75em;
	text-align: left;
}

A#page<?php if (isset ($_GET['page'])) echo $_GET['page']; else echo "1"; ?> {
	BACKGROUND-COLOR: #777777;
	COLOR: #ffffff;
}
</STYLE>
</HEAD>

<BODY>
<DIV class="left-menu">
&raquo; <a href="/">Home</a><br>
&raquo; <a href="/about/" style="font-weight: bold;">About</a><br>
&nbsp;&nbsp;&nbsp;- <A HREF="/about/"  id="page1"><i>Bio</i></A><br>
&nbsp;&nbsp;&nbsp;- <A HREF="cv_MaheshShantaram.pdf" target="blank"><i>Resume</i> <img src="/images/Adobe_PDF_file_icon_24x24.png" width="12" height="12"></A><br>
&nbsp;&nbsp;&nbsp;- <A HREF=".?page=4" id="page4"><i>Contact</i></A><br>
&raquo; <a href="/photography/">Photography</a><br>
</DIV alt="menu">

<DIV class="text">
<?php if (isset ($_GET['page'])) include ($_GET['page']); else include (1); ?>
</DIV>

</BODY>
</HTML>
