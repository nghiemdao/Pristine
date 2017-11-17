(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.Pristine = factory());
}(this, (function () { 'use strict';

var lang = {
    required: "This field is required",
    email: "This field requires a valid e-mail address",
    number: "This field requires a number",
    url: "This field requires a valid website URL",
    tel: "This field requires a valid telephone number",
    maxlength: "This fields length must be < ${1}",
    minlength: "This fields length must be > ${1}",
    min: "Minimum value for this field is ${1}",
    max: "Maximum value for this field is ${1}"
};

var defaultConfig = {
    classTo: 'form-group',
    errorClass: 'has-danger',
    successClass: 'has-success',
    errorTextParent: 'form-group',
    errorTextTag: 'div',
    errorTextClass: 'text-help'
};

var PRISTINE_ERROR = 'pristine-error';
var SELECTOR = "input:not([type^=hidden]):not([type^=submit]), select, textarea";
var ALLOWED_ATTRIBUTES = ["required", "min", "max", 'minlength', 'maxlength'];

var validators = {};

var _ = function _(name, validator) {
    validator.name = name;
    if (!validator.msg) validator.msg = lang[name];
    if (validator.priority === undefined) validator.priority = 1;
    validators[name] = validator;
};

_('text', { fn: function fn(val) {
        return true;
    }, priority: 0 });
_('required', { fn: function fn(val) {
        return val !== '';
    }, priority: 99, halt: true });
_('email', { fn: function fn(val) {
        return (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
        );
    }, priority: 1 });
_('number', { fn: function fn(val) {
        return parseFloat(val);
    }, priority: 1 });
_('minlength', { fn: function fn(val, length) {
        return console.log(val, length) || val && val.length >= parseInt(length);
    }, priority: 1 });
_('maxlength', { fn: function fn(val, length) {
        return val && val.length <= parseInt(length);
    }, priority: 1 });
_('min', { fn: function fn(val, limit) {
        return parseFloat(val) >= parseFloat(limit);
    }, priority: 1 });
_('max', { fn: function fn(val, limit) {
        return parseFloat(val) <= parseFloat(limit);
    }, priority: 1 });

function findAncestor(el, cls) {
    while ((el = el.parentElement) && !el.classList.contains(cls)) {}
    return el;
}

function tmpl(o) {
    var _arguments = arguments;

    return this.replace(/\${([^{}]*)}/g, function (a, b) {
        return _arguments[b];
    });
}

function Pristine(form, config, online) {

    var self = this;

    init(form, config, online);

    function init(form, config, online) {
        self.form = form;
        self.config = config || defaultConfig;
        self.online = !(online === false);
        self.fields = Array.from(form.querySelectorAll(SELECTOR)).map(function (input) {

            var fns = [];
            var params = {};

            ALLOWED_ATTRIBUTES.forEach(function (item) {
                var val = input.getAttribute(item);
                if (val !== null) {
                    _addValidatorToField(fns, params, item, val);
                }
            });

            [].forEach.call(input.attributes, function (attr) {
                if (/^data-pristine-/.test(attr.name)) {
                    var name = attr.name.substr(14);
                    if (name === 'type') name = attr.value;
                    _addValidatorToField(fns, params, name, attr.value);
                }
            });

            _addValidatorToField(fns, params, input.getAttribute('type'));

            fns.sort(function (a, b) {
                return b.priority - a.priority;
            });

            self.online && input.addEventListener(!~['radio', 'checkbox'].indexOf(input.getAttribute('type')) ? 'input' : 'change', function (e) {
                self.validate(e.target);
            }.bind(self));

            input.pristine = { input: input, validators: fns, params: params };
            return input.pristine;
        }.bind(self));
    }

    self.validate = function (input, silent) {
        silent = input && silent === true || input === true;
        var fields = self.fields;
        if (input !== true && input !== false) {
            if (input instanceof HTMLElement) {
                fields = [input.pristine];
            } else if (input instanceof NodeList || input instanceof (window.$ || Array) || input instanceof Array) {
                fields = Array.from(input).map(function (el) {
                    return el.pristine;
                });
            }
        }

        var valid = true;

        for (var i in fields) {
            var field = fields[i];
            if (_validateField(field)) {
                !silent && _showSuccess(field);
            } else {
                valid = false;
                !silent && _showError(field, field.messages);
            }
        }
        return valid;
    };

    self.getErrorMessages = function (input) {
        return input.length ? input[0].pristine.messages : input.pristine.messages;
    };

    function _validateField(field) {
        var messages = [];
        var valid = true;
        for (var i in field.validators) {
            var validator = field.validators[i];
            var params = field.params[validator.name] ? field.params[validator.name] : [];
            params[0] = field.input.value;
            if (!validator.fn.apply(field.input, params)) {
                valid = false;
                messages.push(tmpl.apply(validator.msg, params));
                if (validator.halt === true) {
                    break;
                }
            }
        }
        field.messages = messages;
        return valid;
    }

    self.addValidator = function (elemOrName, fn, msg, priority, halt) {
        if (typeof elemOrName === 'string') {
            _(elemOrName, { fn: fn, msg: msg, priority: priority, halt: halt });
        } else if (elemOrName instanceof HTMLElement) {
            //TODO check if pristine field
            elemOrName.pristine.validators.push({ fn: fn, msg: msg, priority: priority, halt: halt });
            elemOrName.pristine.validators.sort(function (a, b) {
                return b.priority - a.priority;
            });
        }
    };

    function _showError(field, messages) {
        var ret = _removeError(field);
        var errorClassElement = ret[0],
            errorTextParent = ret[1];
        errorClassElement && errorClassElement.classList.add(self.config.errorClass);

        var elem = document.createElement(self.config.errorTextTag);
        elem.className = PRISTINE_ERROR + ' ' + self.config.errorTextClass;
        elem.innerHTML = messages.join('<br/>');
        errorTextParent && errorTextParent.appendChild(elem);
    }

    function _removeError(field) {
        var errorClassElement = findAncestor(field.input, self.config.classTo);
        errorClassElement && errorClassElement.classList.remove(self.config.errorClass, self.config.successClass);

        var errorTextParent = findAncestor(field.input, self.config.errorTextParent);
        var existing = errorTextParent ? errorTextParent.querySelector('.' + PRISTINE_ERROR) : null;
        if (existing) {
            existing.parentNode.removeChild(existing);
        }
        return [errorClassElement, errorTextParent];
    }

    function _showSuccess(field) {
        var errorClassElement = _removeError(field)[0];
        errorClassElement && errorClassElement.classList.add(self.config.successClass);
    }

    self.reset = function () {
        Array.from(self.form.querySelectorAll('.' + PRISTINE_ERROR)).map(function (elem) {
            elem.parentNode.removeChild(elem);
        });
        Array.from(self.form.querySelectorAll('.' + self.config.classTo)).map(function (elem) {
            elem.classList.remove(self.config.successClass, self.config.errorClass);
        });
    };

    self.destroy = function () {
        self.reset();
        self.fields.forEach(function (field) {
            delete field.input.pristine;
        });
        self.fields = [];
    };

    function _addValidatorToField(fns, params, name, value) {
        var validator = validators[name];
        if (validator) {
            fns.push(validator);
            if (value) {
                var valueParams = value.split(',');
                valueParams.unshift(null); // placeholder for input's value
                params[name] = valueParams;
            }
        }
    }

    self.setGlobalConfig = function (config) {
        defaultConfig = config;
    };

    return self;
}

return Pristine;

})));