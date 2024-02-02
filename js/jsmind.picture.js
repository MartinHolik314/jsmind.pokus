const $ = jsMind.$;

const DEFAULT_OPTIONS = {
    filename: null,
    watermark: {
        left: $.w.location,
        right: 'https://github.com/hizzgdev/jsmind',
    },
};

class JmScreenshot {
    constructor(jm, options) {
        var opts = {};
        jsMind.util.json.merge(opts, DEFAULT_OPTIONS);
        jsMind.util.json.merge(opts, options);

        this.version = '0.2.0';
        this.jm = jm;
        this.options = opts;
    }

    get_picture(el) {
        let c = this.create_canvas();
        let ctx = c.getContext('2d');
        return Promise.resolve(ctx)
            .then(() => this.draw_lines(ctx))
            .then(() => this.draw_nodes(ctx))
            .then(() => el.src = c.toDataURL())
            .then(() => this.clear(c));
    }

    create_canvas() {
        let c = $.c('canvas');
        c.width = this.jm.view.size.w;
        c.height = this.jm.view.size.h;
        c.style.visibility = 'hidden';
        this.jm.view.e_panel.appendChild(c);
        return c;
    }

    clear(c) {
        c.parentNode.removeChild(c);
    }

    draw_lines(ctx) {
        return new Promise(
            function (resolve, _) {
                this.jm.view.graph.copy_to(ctx, function () {
                    resolve(ctx);
                });
            }.bind(this)
        );
    }

    draw_nodes(ctx) {
        return domtoimage
            .toSvg(this.jm.view.e_nodes, { style: { zoom: 1 } })
            .then(this.load_image)
            .then(function (img) {
                ctx.drawImage(img, 0, 0);
                return ctx;
            });
    }

    load_image(url) {
        return new Promise(function (resolve, reject) {
            let img = new Image();
            img.onload = function () {
                resolve(img);
            };
            img.onerror = reject;
            img.src = url;
        });
    }
}
