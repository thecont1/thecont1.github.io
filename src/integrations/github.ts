interface GitHubRepo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
  license: {
    name: string;
    spdx_id: string;
  } | null;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

interface GitHubContent {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url: string | null;
}

interface GitHubLanguages {
  [language: string]: number;
}

export class GitHubAPI {
  private token?: string;
  private baseUrl = 'https://api.github.com';

  constructor(token?: string) {
    this.token = token;
  }

  private async fetch(endpoint: string): Promise<any> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Astro-GitHub-Blog-Generator'
    };

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, { headers });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepo> {
    return this.fetch(`/repos/${owner}/${repo}`);
  }

  async getReadme(owner: string, repo: string): Promise<string | null> {
    try {
      const content = await this.fetch(`/repos/${owner}/${repo}/readme`);
      if (content.content) {
        return atob(content.content.replace(/\n/g, ''));
      }
    } catch (error) {
      console.warn(`No README found for ${owner}/${repo}`);
    }
    return null;
  }

  async getLanguages(owner: string, repo: string): Promise<GitHubLanguages> {
    try {
      return await this.fetch(`/repos/${owner}/${repo}/languages`);
    } catch (error) {
      console.warn(`Could not fetch languages for ${owner}/${repo}`);
      return {};
    }
  }

  async getContents(owner: string, repo: string, path: string = ''): Promise<GitHubContent[]> {
    try {
      const contents = await this.fetch(`/repos/${owner}/${repo}/contents/${path}`);
      return Array.isArray(contents) ? contents : [contents];
    } catch (error) {
      console.warn(`Could not fetch contents for ${owner}/${repo}/${path}`);
      return [];
    }
  }

  async getPackageJson(owner: string, repo: string): Promise<any | null> {
    try {
      const content = await this.fetch(`/repos/${owner}/${repo}/contents/package.json`);
      if (content.content) {
        const packageJson = JSON.parse(atob(content.content.replace(/\n/g, '')));
        return packageJson;
      }
    } catch (error) {
      console.warn(`No package.json found for ${owner}/${repo}`);
    }
    return null;
  }
}

export interface RepoData {
  title: string;
  description: string;
  repoUrl: string;
  repoOwner: string;
  repoName: string;
  language: string | null;
  stars: number;
  forks: number;
  license: string | null;
  homepage: string | null;
  lastUpdated: Date;
  tags: string[];
  topics: string[];
  dependencies: string[];
  devDependencies: string[];
  readme: string | null;
  fileTree: string[];
  languages: GitHubLanguages;
}

export async function fetchRepoData(repoIdentifier: string, token?: string): Promise<RepoData> {
  const [owner, repo] = repoIdentifier.split('/');
  if (!owner || !repo) {
    throw new Error('Invalid repository identifier. Use format: owner/repo');
  }

  const api = new GitHubAPI(token);
  
  // Fetch repository metadata
  const repoInfo = await api.getRepository(owner, repo);
  
  // Fetch additional data in parallel
  const [readme, languages, contents, packageJson] = await Promise.all([
    api.getReadme(owner, repo),
    api.getLanguages(owner, repo),
    api.getContents(owner, repo),
    api.getPackageJson(owner, repo)
  ]);

  // Extract dependencies from package.json
  const dependencies = packageJson?.dependencies ? Object.keys(packageJson.dependencies) : [];
  const devDependencies = packageJson?.devDependencies ? Object.keys(packageJson.devDependencies) : [];

  // Build file tree (top-level only)
  const fileTree = contents
    .filter(item => item.type === 'dir')
    .map(item => item.name);

  // Combine topics and language as tags
  const tags = [
    ...repoInfo.topics,
    ...(repoInfo.language ? [repoInfo.language.toLowerCase()] : [])
  ];

  return {
    title: repoInfo.name,
    description: repoInfo.description || '',
    repoUrl: repoInfo.html_url,
    repoOwner: repoInfo.owner.login,
    repoName: repoInfo.name,
    language: repoInfo.language,
    stars: repoInfo.stargazers_count,
    forks: repoInfo.forks_count,
    license: repoInfo.license?.name || null,
    homepage: repoInfo.homepage,
    lastUpdated: new Date(repoInfo.updated_at),
    tags,
    topics: repoInfo.topics,
    dependencies,
    devDependencies,
    readme,
    fileTree,
    languages
  };
}

export function parseRepoIdentifier(input: string): { owner: string; repo: string } {
  // Handle various input formats
  if (input.startsWith('https://github.com/')) {
    const match = input.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  }
  
  // Handle owner/repo format
  const [owner, repo] = input.split('/');
  if (!owner || !repo) {
    throw new Error('Invalid repository identifier');
  }
  
  return { owner, repo };
}
