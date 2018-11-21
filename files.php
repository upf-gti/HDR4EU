<?php

    // Report simple running errors
    error_reporting(E_ERROR | E_WARNING | E_PARSE);
    // Reporting E_NOTICE can be good too (to report uninitialized
    // variables or catch variable name misspellings ...)
    error_reporting(E_ERROR | E_WARNING | E_PARSE | E_NOTICE);
    // Report all errors except E_NOTICE
    error_reporting(E_ALL & ~E_NOTICE);
    // Report all PHP errors (see changelog)
    error_reporting(E_ALL);
    // Report all PHP errors
    error_reporting(-1);
    // Same as error_reporting(E_ALL);
    ini_set('error_reporting', E_ALL);

    $response = [];

    // Use HDR4EU textures
    $directory = "../HDR4EU/textures/sphere_maps/"; 
    $filecount = 0;
    $files = glob($directory . "*.{hdre}", GLOB_BRACE);

    if ($files){
        $filecount = count($files);
    }

    for($i = 0; $i < $filecount; $i += 1)
    {
        $file = array();

        // Process files
        $file_name = $files[$i];
        $aux = $file_name;
        $file_name = substr($file_name, 31);
        $file_name = substr($file_name, 0, -5);
        $file_name = str_replace("_", " ", $file_name);
        $file_name = ucwords($file_name);

        $file["path"] = $aux;
        $file["name"] = $file_name;
        $size = round(floatval(filesize($aux)/1000000), 1);
        $file["filesize"] = $size;
        $response[$file_name] = $file;
    }

    // send info 
    echo json_encode($response);
?>