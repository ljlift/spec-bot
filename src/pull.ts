import { Context } from "probot"
import { join } from "path";
import axios from "axios";
import { load } from "js-yaml"

export const handlePullOpened = async (context: Context) => {
    const resp = await context.octokit.issues.createComment({
        ...context.repo(),
        issue_number: context.payload.number,
        body: "Received pull request, start validation for spec file."
    });
    const commentID = resp.data.id;

    const v = new Validation(context);
    const validationResult = await v.validate();

    await context.octokit.issues.updateComment({
        ...context.repo(),
        comment_id: commentID,
        body: `Validation ends. Result shows as bellow:\n${validationResult}`
    })
}

class Validation {
    private readonly API_SPACE_CONFIG_FOLDER = '.api-space';
    private readonly API_SPACE_CONFIG_FILE_NAME = 'config.yaml';
    // key of spec file dest in config file
    private readonly SPEC_FILE_KEY = 'spec-file-dest';
    private readonly API_SPACE_SERVER_HOST: string;
    private APISpaceConfig: any;

    constructor (private context: Context) {
        let host = process.env.APISPACE_SERVER_HOST;
        if (!host?.startsWith("http")) {
            host = "http://" + host
        }
        this.API_SPACE_SERVER_HOST = host;
    }

    private async getGitHubFileContent(path: string) {
        const octokitResp = await this.context.octokit.rest.repos.getContent({
            ...this.context.repo(),
            path
        });

        let download_url;
        if (!Array.isArray(octokitResp.data)) {
            download_url = octokitResp.data["download_url"]
        } else {
            download_url = octokitResp.data[0]["download_url"]
        }
        const resp = await axios.get(download_url as string);
        return await resp.data; 
    }

    private async getAPISpaceConfig() {
        const path = join(this.API_SPACE_CONFIG_FOLDER, this.API_SPACE_CONFIG_FILE_NAME).replace("\\", "/");
        return load(await this.getGitHubFileContent(path));
    }

    private async getSpecFileContent() {
        const specFileDest = this.APISpaceConfig[this.SPEC_FILE_KEY];
        return await this.getGitHubFileContent(specFileDest);
    }

    private async requestValidationResult(spec: string) {
        
        const response = await axios.post(
            `${this.API_SPACE_SERVER_HOST}/api/v1/validation`,
            JSON.stringify({
                uri: this.context.payload.repository["ssh_url"],
                spec: spec
            }),
            {
                headers: {
                    "Content-type": "application/json; charset=UTF-8",
                    Accept: "application/json, text/plain, */*"
                },
            }
        )
        const result = response.data.result;
        return result
    }

    async validate() {
        this.APISpaceConfig = await this.getAPISpaceConfig();
        const specFileContent = await this.getSpecFileContent();
        return await this.requestValidationResult(specFileContent);
    }
}
