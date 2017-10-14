'use strict';

const path = require('path');
const handlebarsHelpers = require('handlebars-helpers');
const PaniniEngine = require('../lib/engine');
const folders = require('../lib/folders');

const globPattern = '/**/*.{html,hbs,handlebars}';
const getPartialName = (inputFolder, filePath) => {
  return path.relative(
    path.join(process.cwd(), inputFolder, folders.partials),
    filePath
  ).replace(/\..*$/, '');
};

/**
 * Panini engine to render Handlebars templates.
 */
class HandlebarsEngine extends PaniniEngine {
  /**
   * Create a new engine instance.
   * @param {object} options - Panini options.
   */
  constructor(options) {
    super(options);

    const handlebars = require('handlebars');
    this.engine = handlebars.create();
    this.compilerOpts = {
      preventIndent: true
    };

    if (this.options.builtins) {
      handlebarsHelpers({
        handlebars: this.engine
      });
    }
  }

  /**
   * Render a Handlebars page and layout.
   * @param {String} pageBody - Handlebars template string.
   * @param {Object} pageData - Handlebars context.
   * @param {Object} file - Vinyl source file.
   * @returns {String} Rendered page.
   */
  render(pageBody, pageData, file) {
    const layout = this.layouts[pageData.layout];

    try {
      if (!layout) {
        if (pageData.layout === 'default') {
          throw new Error('You must have a layout named "default".');
        } else {
          throw new Error(`No layout named "${pageData.layout}" exists.`);
        }
      }

      const page = layout.replace(/{{> ?body ?}}/, pageBody);
      const template = this.engine.compile(page, this.compilerOpts);

      return template(pageData);
    } catch (err) {
      return this.error(err, file.path);
    }
  }
}

HandlebarsEngine.watchers = [
  {
    pattern: folders.layouts + globPattern,
    read: true,
    update(name, filePath, contents) {
      this.layouts[name] = contents;
    },
    remove(name) {
      delete this.layouts[name];
    }
  },
  {
    pattern: folders.partials + globPattern,
    read: true,
    update(name, filePath, contents) {
      const partialName = getPartialName(this.options.input, filePath);
      this.engine.registerPartial(partialName, contents);
    },
    remove(name, filePath) {
      const partialName = getPartialName(this.options.input, filePath);
      this.engine.unregisterPartial(partialName);
    }
  },
  {
    pattern: `${folders.helpers}/**/*.js`,
    update(name, filePath) {
      try {
        if (this.engine.helpers[name]) {
          delete require.cache[require.resolve(filePath)];
          this.engine.unregisterHelper(name);
        }

        const helper = require(filePath);
        this.engine.registerHelper(name, helper);
      } catch (err) {
        console.warn('Error when loading ' + name + '.js as a Handlebars helper.');
      }
    },
    remove(name) {
      this.engine.unregisterHelper(name);
    }
  }
];

HandlebarsEngine.requires = 'handlebars';

module.exports = HandlebarsEngine;
