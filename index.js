const mdContainer = require('markdown-it-container');
const anchor = require('markdown-it-anchor');
const frontMatter = require('front-matter');
const highlight = require('highlight.js');
const slugify = require('transliteration').slugify;

let md = require('markdown-it');

let options = {
    className: 'doc'
};

md = md('commonmark').enable([
    'smartquotes'
]).use(anchor, {
    slugify: slugify,
    permalink: true,
    permalinkBefore: true
}).set({
    highlight(content, languageHint) {
        let highlightedContent, highlightMarkUp;

        highlight.configure({
            useBR: true,
            tabReplace: '    '
        });

        if (languageHint && highlight.getLanguage(languageHint)) {
            try {
                highlightedContent = highlight.highlight(languageHint, content).value;
            } catch (err) {
            }
        }

        if (!highlightedContent) {
            try {
                highlightedContent = highlight.highlightAuto(content).value;
            } catch (err) {
            }
        }

        // 把代码中的{}转
        highlightedContent = highlightedContent.replace(/[\{\}]/g, (match) => `{'${match}'}`);

        highlightMarkUp = '<pre><code class="hljs ' + languageHint + '">'
            + highlightedContent
            + '</code></pre>'

        // 加上 hljs
        // highlightedContent = highlightedContent.replace('<code class="', '<code class="hljs ').replace('<code>', '<code class="hljs">')

        return highlight.fixMarkup(highlightMarkUp);
    }
});

const formatModule = (imports, js, jsx) => {
    let moduleText = `
    ${imports}
    
    ${js}
    
    class MarkdownItReactComponent extends React.Component {
        constructor(props){
            super(props);
            this.state = {};
        }
        handleToggleCode(flag){
            const state = {};
            state['showCode' + flag] = !this.state['showCode' + flag];
            this.setState(state);
        }
        
        render(){
            return (
                <div className="${options.className}">
                    ${jsx}
                </div>
            );
        }
    };

    export default MarkdownItReactComponent;`;

    return moduleText;
};

const formatOpening = (code, title, description, flag) => {

    const desc = description ? `<div className="${options.className}-demo-description">${description}</div>` : '';

    return (
        `
        <h3>${title}</h3>
        ${desc}
        <div className={"${options.className}-demo-box " + (this.state['showCode' + ${flag}] ? "${options.className}-demo-code-active" : "")}>
            <div className="${options.className}-demo-instance">               
                ${code}
            </div>
            <div className="${options.className}-demo-meta">
                 <div className="${options.className}-demo-code">`);
};

const formatClosing = (flag) => {
    return (
        `</div>
            <div className="${options.className}-demo-code-btn" onClick={this.handleToggleCode.bind(this, ${flag})}>
                <i/>
                </div>
             </div>
        </div>`);
};


module.exports = function (source) {
    this.cacheable();

    // init options
    Object.assign(options, this.options.markdownItReact ? this.options.markdownItReact() : {});

    const { body, attributes: { imports: importMap } } = frontMatter(source);
    const imports = 'import React from \'react\';' + importMap;

    let moduleJS = [], htmlContent = [];
    let flag = '';

    // demo 区块的
    md.use(mdContainer, 'demo', {
        validate: function (params) {
            return params.trim().match(/^demo\s*(.*)$/);
        },
        render: function (tokens, idx) {
            // container 从开头到结尾把之间的token跑一遍，其中idx定位到具体的位置

            // 获取title 和 subTitle
            const m = tokens[idx].info.trim().match(/^demo\s*(.*)$/);

            // 有此标记代表 ::: 开始
            if (tokens[idx].nesting === 1) {
                flag = idx;
                let s_array = ['', ''];


                if (m.length > 1) {
                    let mContent = m[1];
                    if (mContent && mContent.indexOf('|') > 0) {
                        s_array = mContent.split('|')
                    }
                }

                let jsx = '', i = 1;

                // 从 ::: 下一个token开始
                let token = tokens[idx + i];

                // 如果没有到结尾
                while (token.markup !== ':::') {
                    // 只认```，其他忽略
                    if (token.markup === '```') {
                        if (token.info === 'js') {
                            // 插入到import后，component前
                            moduleJS.push(token.content);
                        } else if (token.info === 'jsx') {
                            // 插入render内
                            jsx = token.content;
                        }
                    }
                    i++;
                    token = tokens[idx + i]
                }
                // 描述也执行md
                return formatOpening(jsx, s_array[0], s_array[1], flag);
            }
            return formatClosing(flag);
        }
    });


    // md 处理过后的字符串含有 class 和 style ，需要再次处理给到react
    let content = md.render(body)
        .replace(/<hr>/g, '<hr />')
        .replace(/<br>/g, '<br />')
        .replace(/class=/g, 'className=');

    return formatModule(imports, moduleJS.join('\n'), content);
};