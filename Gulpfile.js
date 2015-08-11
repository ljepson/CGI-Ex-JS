var gulp = require('gulp');
var plugins = require('gulp-load-plugins')();

gulp.task('debug', function() {
    'use strict';

    gulp.src(['server.js'])
        .pipe(plugins.nodeDebug({
            debugBrk: false,
            noPreload: true,
            cli: true
        }));
});

gulp.task('serve', function() {
    'use strict';

    plugins.livereload.listen();

    plugins.nodemon({
        script: 'server.js',
        ext: 'js'
    })
        .on('restart', function() {
            setTimeout(function() {
                gulp.src('server.js')
                    .pipe(plugins.livereload());
            }, 1);
        });
});
