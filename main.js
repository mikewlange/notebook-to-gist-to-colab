

define(['jquery', 'base/js/namespace', 'base/js/dialog'], function($, Jupyter, dialog) {
    "use strict";

    var CONFIG = {
        gistsUrl: 'https://api.github.com/gists',
        nbviewerBaseUrl: 'https://colab.research.google.com/gist/',
        personal_access_token: 'XXX'
    }; // define default values for config parameters

    var params = {
        togist_tocolab_default_to_public: false,
        togist_tocolab_personal_access_token: gis,
        github_endpoint: 'github.com'
    };

    var initialize = function() {
        update_params();
        Jupyter.toolbar.add_buttons_group([
            Jupyter.keyboard_manager.actions.register({
                help: 'Create Gist of Notebook Then Open in Colab',
                icon: 'fa-github',
                handler: show_gist_editor_modal
            }, 'create-gist-from-notebook', 'togist_tocolab')
        ]);
    };

    var update_params = function update_params() {
        var config = Jupyter.notebook.config;

        for (var key in params) {
            if (config.data.hasOwnProperty(key)) params[key] = config.data[key];
        }

        default_metadata.data.public = Boolean(config.data.togist_tocolab_default_to_public);
    };

    var default_metadata = {
        id: '',
        data: {
            description: Jupyter.notebook.notebook_path,
            public: false
        }
    };

    function ensure_default_metadata() {
        Jupyter.notebook.metadata.gist = $.extend(true, // deep-copy
            default_metadata, //defaults
            Jupyter.notebook.metadata.gist // overrides
        );
    }

    var add_auth_token = function add_auth_token(xhr) {
        var token = '';

        if (params.togist_tocolab_personal_access_token !== '') {
            token = params.togist_tocolab_personal_access_token;
        }

        if (token !== '') {
            xhr.setRequestHeader("Authorization", "token " + token);
        }
    };
    /**
     * Add gutter to a new cell
     *
     * @param event
     * @param nbcell
     *
     */

    var createCell = function createCell(event, nbcell) {
        var cell = nbcell.cell;

        if (_instanceof(cell, codecell.CodeCell)) {
            var gutters = cell.code_mirror.getOption('gutters').slice();

            if ($.inArray("CodeMirror-cellstate", gutters) < 0) {
                gutters.push('CodeMirror-cellstate');
                cell.code_mirror.setOption('gutters', gutters);
                cell.code_mirror.on("gutterClick", changeEvent);
            }
        }
    };

    function build_alert(alert_class) {
        return $('<div/>').addClass('alert alert-dismissable').addClass(alert_class) // .headers.filename("<script src='https://unpkg.com/@jupyter-widgets/html-manager@*/dist/embed.js' crossorigin='anonymous'></script>")
            .append($('<div class="wrap"><a href="#" class="button">Hover Me!</a>').append($('<span aria-hidden="false"/>').html('&times;')));
    }

    function gist_error(jqXHR, textStatus, errorThrown) {
        console.log('github ajax error:', jqXHR, textStatus, errorThrown);
        var alert = build_alert('alert-danger').hide().append($('<p/>').text('The ajax request to Github went wrong:')).append($('<pre/>').text(jqXHR.responseJSON ? JSON.stringify(jqXHR.responseJSON, null, 2) : errorThrown));
        $('#gist_modal').find('.modal-body').append(alert);
        alert.slideDown('fast');
    }

    function gist_success(response, textStatus, jqXHR) {
        // if (Jupyter.notebook.metadata.gist.id === response.id) return;
        Jupyter.notebook.metadata.gist.id = response.id;
        Jupyter.notebook.metadata._draft = $.extend(true, // deep copy
            Jupyter.notebook.metadata._draft, // defaults
            {
                nbviewer_url: response.html_url
            } // overrides
        );
        var d = new Date();
        var msg_head = d.toLocaleString() + ': Gist ';
        var msg_tail = response.history.length === 1 ? ' published' : ' updated to revision ' + response.history.length;
        var alert = build_alert('alert-success').hide().append(msg_head).append($('<a/>').attr('href', response.html_url).attr('target', '_blank').text(response.id)).append(msg_tail);
        $('#gist_modal').find('.modal-body').append(alert);
        alert.slideDown('fast');
    }

    function get_github_endpoint() {
        return params.github_endpoint !== '' ? params.github_endpoint : 'github.com';
    }

    function get_api_endpoint() {
        var github_endpoint = get_github_endpoint();

        if (github_endpoint === 'github.com') {
            return 'https://api.' + github_endpoint;
        } else {
            // Github Enterprise
            // https://developer.github.com/enterprise/2.18/v3/enterprise-admin/#endpoint-urls
            return 'https://' + github_endpoint + '/api/v3';
        }
    }



    function update_gist_editor(gist_editor) {
        if (gist_editor === undefined) gist_editor = $('#gist_editor');
        var id_input = gist_editor.find('#gist_id');
        var have_auth = params.togist_tocolab_personal_access_token !== '';
        var id = '';
        var is_public = true;

        if (have_auth) {
            id = Jupyter.notebook.metadata.gist.id;
            is_public = Jupyter.notebook.metadata.gist.data.public;
            id_input.val(id);
        }

        id_input.closest('.form-group').toggle(have_auth);
        gist_editor.find('#gist_public').prop('checked', is_public).prop('readonly', !have_auth);
        gist_editor.find('#gist_description').val(Jupyter.notebook.metadata.gist.data.description);

        if (have_auth) {
            gist_id_updated_callback(gist_editor);
        }
    }

    function build_gist_editor() {
        ensure_default_metadata();
        var gist_editor = $('#gist_editor');
        if (gist_editor.length > 0) return gist_editor;
        gist_editor = $('<div/>').attr('id', 'gist_editor').append(controls);
        var id = params.togist_tocolab_personal_access_token !== '' ? Jupyter.notebook.metadata.gist.id : '';
        var controls = $('<form/>').appendTo(gist_editor).addClass('form-horizontal');
        // $('<div/>').addClass('has-feedback').hide().appendTo(controls).append($('<label/>').attr('for', 'gist_id').text('Gist id')).append($('<input/>').addClass('form-control').attr('id', 'gist_id').val(Jupyter.notebook.metadata.gist.id)).append($('<span/>').addClass('form-control-feedback').append($('<i/>').addClass('fa fa-lg'))).append($('<span/>').addClass('help-block'));
        $('<div/>').appendTo(controls).append($('<div/>').addClass('checkbox').append($('<label>').text('Make the gist public').prepend($('<input/>').attr('type', 'checkbox').attr('id', 'gist_public').prop('checked', Jupyter.notebook.metadata.gist.data.public).prop('readonly', id === '')))).append($('<label/>').attr('for', 'gist_public').text('public'));
        $('<div/>').appendTo(controls).append($('<label/>').attr('for', 'gist_description').text('description')).append($('<input/>').addClass('form-control').attr('id', 'gist_description').attr('type', 'textarea').val(Jupyter.notebook.metadata.gist.data.description));
        var form_groups = controls.children('div').addClass('form-group');
        form_groups.children('label').addClass('col-sm-2 control-label').css('padding-right', '1em');
        form_groups.each(function(index, elem) {
            $('<div/>').appendTo(elem).addClass('col-sm-10').append($(elem).children(':not(label)'));
        });
        update_gist_editor(gist_editor); // bind events for id changing

        // var id_input = gist_editor.find('#gist_id'); // Save current value of element

        id_input.data('oldVal', id_input.val()); // Look for changes in the value

        id_input.bind("change click keyup input paste", function(event) {
            // If value has changed...
            if (id_input.data('oldVal') !== id_input.val()) {
                // Updated stored value
                id_input.data('oldVal', id_input.val()); // Do action

                gist_id_updated_callback(gist_editor);
            }
        });
        return gist_editor;
    }

    function show_gist_editor_modal() {
        var modal;
        modal = dialog.modal({
            show: false,
            title: 'Push to Gist Open In Colab',
            notebook: Jupyter.notebook,
            keyboard_manager: Jupyter.notebook.keyboard_manager,
            body: build_gist_editor(),
            buttons: {
                'Open In Colab!': {
                    class: 'btn-primary',
                    click: function click() {
                        modal.find('.btn').prop('disabled', true);
                        var new_data = {
                            public: $('#gist_public').prop('checked'),
                            description: $('#gist_description').val() + ".ipynb",
                            extension: '.ipynb'
                        };
                        $.extend(true, Jupyter.notebook.metadata.gist, new_data); // prevent the modal from closing. See github.com/twbs/bootstrap/issues/1202

                        modal.data('bs.modal').isShown = false;
                        var spinner = modal.find('.btn-primary .fa-github').addClass('fa-spin');
                        make_gist(function(jqXHR, textStatus) {
                            modal.find('.btn').prop('disabled', false); // allow the modal to close again. See github.com/twbs/bootstrap/issues/1202

                            modal.data('bs.modal').isShown = true;
                            spinner.removeClass('fa-spin');
                        });
                    }
                },
                done: {}
            }
        }).attr('id', 'gist_modal').on('shown.bs.modal', function(evt) {
            var err = modal.find('#gist_id').parent().hasClass('has-error');
            modal.find('.btn-primary').prop('disabled', err);
        });
        modal.find('.btn-primary').prepend($('<i/>').addClass('fa fa-lg fa-github'));
        modal.modal('show');
    }

    var make_gist = function make_gist(complete_callback) {
        ensure_default_metadata();
        var data = $.extend(true, // deep-copy
            {
                files: {}
            }, // defaults
            Jupyter.notebook.metadata.gist.data // overrides
        );
        var filename = Jupyter.notebook.notebook_name;
        data.files[filename] = {
            content: JSON.stringify(Jupyter.notebook.toJSON(), null, 2)
        };
        /**
         * Add gutter to a new cell
         *
         * @param event
         * @param nbcell
         *
         */

        var createCell = function createCell(event, nbcell) {
            var cell = nbcell.cell;

            if (_instanceof(cell, codecell.CodeCell)) {
                var gutters = cell.code_mirror.getOption('gutters').slice();

                if ($.inArray("CodeMirror-cellstate", gutters) < 0) {
                    gutters.push('CodeMirror-cellstate');
                    cell.code_mirror.setOption('gutters', gutters);
                    cell.code_mirror.on("gutterClick", changeEvent);
                }
            }
        };

        var gistsUrl = CONFIG.gistsUrl;

        if (CONFIG.personal_access_token) {
            gistsUrl = "".concat(gistsUrl, "?oauth_token=",CONFIG.personal_access_token);
        }

        var settings = {
            async: true,
            crossDomain: true,
            type: 'POST',
            headers: {},
            dataType: 'json',
            data: JSON.stringify(data),
            success: function success(data, status) {
                var end = data.owner.login + '/' + data.id;
                setTimeout(function() {
                    window.location.replace(CONFIG.nbviewerBaseUrl + end);
                }, 7000);
            }
        };
        $.ajax(gistsUrl, settings).catch(function(jqXHR, status, err) {
            var errorMsg = jqXHR.readyState === 0 && !err ? 'NETWORK ERROR!' : err;

            if (jqXHR.responseJSON && jqXHR.responseJSON.message) {
                errorMsg = jqXHR.responseJSON.message;
            }

            console.log(errorMsg);
            onErrorCb(errorMsg);
        });
    };

    function load_jupyter_extension() {
        return Jupyter.notebook.config.loaded.then(initialize);
    }

    return {
        load_jupyter_extension: load_jupyter_extension
    };
});
