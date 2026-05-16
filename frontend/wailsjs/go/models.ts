export namespace main {
	
	export class AIProvider {
	    id: string;
	    name: string;
	    provider: string;
	    base_url: string;
	    api_key: string;
	    model: string;
	    is_default: boolean;
	
	    static createFrom(source: any = {}) {
	        return new AIProvider(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.provider = source["provider"];
	        this.base_url = source["base_url"];
	        this.api_key = source["api_key"];
	        this.model = source["model"];
	        this.is_default = source["is_default"];
	    }
	}
	export class ChapterContent {
	    id: string;
	    title: string;
	    outline: string;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new ChapterContent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.outline = source["outline"];
	        this.content = source["content"];
	    }
	}
	export class ChapterSummary {
	    id: string;
	    title: string;
	    outline: string;
	    order_key: number;
	
	    static createFrom(source: any = {}) {
	        return new ChapterSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.outline = source["outline"];
	        this.order_key = source["order_key"];
	    }
	}
	export class RecentFile {
	    path: string;
	    title: string;
	    updated_at: string;
	
	    static createFrom(source: any = {}) {
	        return new RecentFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.title = source["title"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class Config {
	    recent_files: RecentFile[];
	    theme: string;
	    theme_family: string;
	    theme_mode: string;
	    last_workspace: string;
	    editor_width: string;
	    editor_width_narrow: number;
	    editor_width_medium: number;
	    editor_width_wide: number;
	    editor_font: string;
	    font_size: string;
	    font_size_small: number;
	    font_size_medium: number;
	    font_size_large: number;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.recent_files = this.convertValues(source["recent_files"], RecentFile);
	        this.theme = source["theme"];
	        this.theme_family = source["theme_family"];
	        this.theme_mode = source["theme_mode"];
	        this.last_workspace = source["last_workspace"];
	        this.editor_width = source["editor_width"];
	        this.editor_width_narrow = source["editor_width_narrow"];
	        this.editor_width_medium = source["editor_width_medium"];
	        this.editor_width_wide = source["editor_width_wide"];
	        this.editor_font = source["editor_font"];
	        this.font_size = source["font_size"];
	        this.font_size_small = source["font_size_small"];
	        this.font_size_medium = source["font_size_medium"];
	        this.font_size_large = source["font_size_large"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class FileInfo {
	    path: string;
	    title: string;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new FileInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.title = source["title"];
	        this.content = source["content"];
	    }
	}
	export class FileTreeNode {
	    name: string;
	    path: string;
	    is_dir: boolean;
	    children?: FileTreeNode[];
	
	    static createFrom(source: any = {}) {
	        return new FileTreeNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.is_dir = source["is_dir"];
	        this.children = this.convertValues(source["children"], FileTreeNode);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Novel {
	    id: string;
	    title: string;
	    summary: string;
	    meta_json: string;
	    created_at: string;
	    updated_at: string;
	
	    static createFrom(source: any = {}) {
	        return new Novel(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.summary = source["summary"];
	        this.meta_json = source["meta_json"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class NovelSummary {
	    id: string;
	    title: string;
	    summary: string;
	    updated_at: string;
	
	    static createFrom(source: any = {}) {
	        return new NovelSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.summary = source["summary"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class RecentChapterSummary {
	    novel_id: string;
	    novel_title: string;
	    chapter_id: string;
	    chapter_title: string;
	    outline: string;
	    updated_at: string;
	
	    static createFrom(source: any = {}) {
	        return new RecentChapterSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.novel_id = source["novel_id"];
	        this.novel_title = source["novel_title"];
	        this.chapter_id = source["chapter_id"];
	        this.chapter_title = source["chapter_title"];
	        this.outline = source["outline"];
	        this.updated_at = source["updated_at"];
	    }
	}
	
	export class UpdateInfo {
	    has_update: boolean;
	    latest_version: string;
	    current_version: string;
	    release_url: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.has_update = source["has_update"];
	        this.latest_version = source["latest_version"];
	        this.current_version = source["current_version"];
	        this.release_url = source["release_url"];
	    }
	}
	export class Workspace {
	    name: string;
	    folders: string[];
	
	    static createFrom(source: any = {}) {
	        return new Workspace(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.folders = source["folders"];
	    }
	}

}

