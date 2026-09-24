<?php
/**
 * Plugin Name: ODR RRUFF Mineral Calculator
 * Description: A plugin that gives a way to break down a mineral's valence formula into its elemental mass percentages, formula mass, and net charge
 * Version: 1.3.1
 */

if (!defined('ABSPATH')) {
    exit; // No direct access.
}

function ormc_enqueue_assets() {
    wp_enqueue_style(
        'ormc-reset',
        plugin_dir_url(__FILE__) . 'reset.css',
        array(),
        filemtime(plugin_dir_path(__FILE__) . 'reset.css')
    );

    $dist_dir = plugin_dir_path(__FILE__) . 'dist/assets/';
    $dist_url = plugin_dir_url(__FILE__) . 'dist/assets/';

    $js_files = glob($dist_dir . 'index-*.js');
    if (empty($js_files)) {
        return;
    }
    $js_file = basename($js_files[0]);

    wp_enqueue_script(
        'ormc-app',
        $dist_url . $js_file,
        array(),
        filemtime($dist_dir . $js_file),
        true // load in footer
    );

    // The build output is an ES module.
    add_filter('script_loader_tag', function ($tag, $handle) {
        if ($handle === 'ormc-app') {
            $tag = str_replace(' src', ' type="module" src', $tag);
        }
        return $tag;
    }, 10, 2);

    $css_files = glob($dist_dir . 'index-*.css');
    if (!empty($css_files)) {
        $css_file = basename($css_files[0]);
        wp_enqueue_style(
            'ormc-app',
            $dist_url . $css_file,
            array(),
            filemtime($dist_dir . $css_file)
        );
    }
}

function ormc_shortcode() {
    ormc_enqueue_assets();
    return '<div id="mineral-parser-root"></div>';
}
add_shortcode('odr-rruff-mineralcalc', 'ormc_shortcode');
