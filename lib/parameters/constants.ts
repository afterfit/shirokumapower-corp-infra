/**
 * This file contain parameters to deploy to each environments.
 * Or a common constants to use in the project as a whole.
 * CDK application will uses this parameters to reference resources created outside of the app, or a customize parameter belong to your own project.
 * For ex: Common Codestar Connections to Github (which has to make manually), or a domain name, which will be difference for each project.
 */

export const commonConstants = {
	project: "template",
}

export const envConstants = {
	"dev": {
			cidr: "10.0.0.0/16",
			domain: "dev.template.com",
			codeBranch: "develop"
	},
	"stg": {
			cidr: "10.1.0.0/16",
			domain: "stg.template.com",
			codeBranch: "staging"
	},
	"prod": {
			cidr: "10.2.0.0/16",
			domain: "template.com",
			codeBranch: "main"
	}
}